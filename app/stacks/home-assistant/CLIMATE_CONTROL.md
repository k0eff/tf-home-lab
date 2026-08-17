# Home Assistant Climate Control Contract

This document describes the intended behavior for the LivingR, BedroomB, and
BedroomS climate programs. Home Assistant live helpers are the runtime source
of truth for tunable parameters. Terraform backports those settings and
automations so the setup can be recreated, reviewed, and versioned.

## Scope

- LivingR, BedroomB, and BedroomS use the same control algorithm.
- Room-specific differences should be data only: entity IDs, sensor priority,
  targets, thresholds, fan modes, and schedule helpers.
- Dashboards are the control surface for runtime parameters.
- Terraform must not introduce a second set of helper names for the same
  concept.
- BedroomS was the last room to receive this algorithm and historically
  lagged behind LivingR/BedroomB on feature parity (away detection, night
  cooling gate). When adding a feature to one room, check the other two for
  the same gap before assuming it's already equalized.

## Canonical Helper Names

Each room uses the room prefix: `livingr`, `bedroomb`, or `bedrooms`.

- Program enable intent: `input_boolean.<room>_program_requested`
- Manual override active flag: `input_boolean.<room>_manual_override`
- Manual override duration: `input_number.<room>_override_duration`
- Manual target temperature: `input_number.<room>_manual_target_temperature`
- Manual HVAC mode: `input_select.<room>_manual_hvac_mode`
- Manual fan mode: `input_select.<room>_manual_fan_mode`
- Manual swing mode: `input_select.<room>_manual_swing_mode`
- Manual override expiry: `input_datetime.<room>_manual_override_until`

Do not recreate the older `_manual_override_active` /
`_manual_override_target_temperature` helper family. If it appears again, treat
it as a migration bug.

## Comfort Loop

The comfort automation runs on a periodic trigger plus relevant sensor, weather,
motion, and schedule changes.

Before it does anything, it must pass these guards:

- The climate entity is available.
- The climate entity exposes `current_temperature`.
- An outside temperature source is available.
- Manual override is not active.

### Room Temperature Source

The comfort loop needs a room temperature (`effective`) to compare against
`target`. It is derived from up to two inputs per room: the Xiaomi room
sensor(s) and the climate entity's own `current_temperature` (`ac_temp`).

- LivingR has one room sensor. BedroomB has a primary and a secondary
  (ceiling) room sensor, tried in that order.
- A room sensor counts as a *candidate* only if its battery is above the
  configured minimum and it has a numeric state.
- A candidate room sensor is also checked for **staleness**: a dedicated
  tracker automation (`automation.test_aircon_room_sensor_fluctuation_tracker`)
  records, per sensor, the last time its numeric value moved by at least
  `0.1`C (`input_datetime.<key>_last_moved`). If the sensor value has not
  genuinely moved within `input_number.<room>_room_sensor_stale_hours`
  (default 5h), the candidate is treated as stale and skipped, even if HA
  still reports its state as a normal number.
  - This is deliberately independent of `last_changed`/`last_updated`.
    A cloud-polled sensor that flickers `unavailable` and then reports the
    exact same cached value again still resets `last_changed`, so
    `last_changed` alone cannot detect a frozen reading.
- If no room sensor candidate is healthy, `effective` falls back to `ac_temp`
  (`source = 'climate_fallback'`).
- If a healthy room sensor candidate disagrees with `ac_temp` by at least
  `input_number.<room>_room_ac_disagreement_threshold` (default 1.5C), the
  loop does not trust the room sensor blindly. Instead it takes the less
  comfortable of the two readings for the current season
  (`source = 'conflict_worst_case'`): the max in summer, the min in winter,
  the room reading in neutral mode. Otherwise it uses the healthy candidate
  directly (`source = 'room_sensor'` / `'primary_room_sensor'` /
  `'secondary_room_sensor'`).

The outside source fallback order is:

1. Venti In room sensor minus the configured offset, when its battery is healthy.
2. `weather.forecast_home` temperature.
3. `sensor.venti_outside_temperature`.

The season mode is computed from outside temperature:

- Winter: outside temperature is at or below the configured winter threshold.
- Summer: outside temperature is at or above the configured summer threshold.
- Neutral: between those thresholds, no comfort heating/cooling action runs.

Summer target selection:

- Mild summer target is used when outside is below the mild outside threshold.
- Hot summer target is used when outside is at or above the mild threshold.
- Night summer target is used during the configured night window.
- LivingR additionally requires `input_boolean.livingr_allow_night_cooling` for
  cooling during the night window.
- The practical upper edge of the summer comfort band is
  `target + cooling_start_delta`. For the current LivingR day target, keep
  `livingr_cooling_start_delta` around `0.3` to hold a roughly 23.9-24.3 C band.

The dynamic climate setpoint is computed from the room error:

```text
error = effective_room_temperature - target_room_temperature
dynamic_setpoint = climate_current_temperature - error
```

The setpoint is rounded to 0.5 C and clamped to the supported climate range.

## Away Detection And Energy Saving

All three rooms relax the comfort band by `<room>_away_relax_delta` (added to
both the cooling and winter start deltas) when away is true:

```text
away_by_presence  = both tracked people are not_home
away_by_no_motion = day_air_clean_window and no motion on motion01, motion03,
                     or motion04spalniam for 30+ minutes
away = <room>_allow_away_saving is on and (away_by_presence or away_by_no_motion)
```

Note the motion check is whole-house, not per-room: all three rooms compute
`away` from the same three motion sensors. A room's own automation cannot
tell "someone is in this specific room" from "someone is home and moving
anywhere" - it only relaxes when the whole house looks quiet.

`away_by_no_motion` is gated by `day_air_clean_window` (09:00-23:59, per
`input_datetime.bedrooms_day_start`), so intersected with the night window it
can only go true between 19:30 and 23:59, not for the rest of the night -
still an expected pre-midnight event once everyone falls asleep and stops
moving for 30+ minutes, not an absence. That distinction matters wherever
"away" gates a state that should only be released by genuine absence, not by
sleep: see [hard_away](#night-fixed-cooling-bedrooms) below.

## Return Boost (all 3 rooms, as of 2026-07-19)

The away-relax band trades comfort for energy savings while the room is
unoccupied. Left alone, undoing that trade after someone returns is slow: the
comfort loop only nudges the dynamic setpoint, and at the room's normal quiet
fan speed the real room air does not mix fast enough to reach target in a
reasonable time (~1 hour observed) even though the AC's own internal sensor
reports approaching setpoint much sooner - it reads the air right next to the
unit, not the room.

To fix that without giving up the quiet fan speed once the room is actually
comfortable, every room has:

- `input_boolean.<room>_was_away` mirrors the room's own `away` value every
  automation run.
- The moment `away` flips from true to false (return-from-away edge, detected
  by comparing to `<room>_was_away` before overwriting it), the automation
  stamps `input_datetime.<room>_away_ended_at = now()` and logs it.
- For `input_number.<room>_return_boost_minutes` minutes after that
  timestamp, `cooling_fan_mode` resolves to
  `input_number.<room>_return_boost_fan_mode` (default 5) instead of the
  normal `input_number.<room>_cooling_fan_mode` (default 2). After the
  window elapses, fan speed drops back to normal automatically - no separate
  automation, no manual reset.

All six related helpers (`allow_away_saving`, `away_relax_delta`, `was_away`,
`away_ended_at`, `return_boost_minutes`, `return_boost_fan_mode`) are exposed
on each room's dashboard view (`living`/`bedb`/`beds`) in an "Away & Return
Boost" entities card, so tuning does not require editing automation YAML -
`was_away`/`away_ended_at` are shown for visibility into current state even
though they're written by the automation, not meant for direct editing.

## Manual Override

Manual override is a hard ownership mode. While it is active and its expiry time
is in the future:

- The comfort automation must stand down completely.
- The manual override automation owns the climate state.
- Manual HVAC mode, target temperature, fan mode, and swing mode are reapplied
  on manual changes and on the periodic expiry check while the override remains
  active.
- When the override expires or is cancelled, the comfort automation may run
  again if the room program is requested.

This re-apply rule is intentional. MELCloud can drift or report a stale state,
and a separate comfort automation must not be the only thing that corrects an
active manual override.

## Night Fixed Cooling (BedroomS)

BedroomS-only. On summer nights, the normal proportional comfort-band cycling
(on/off/fan_only/coil cool-down) is replaced by a single fixed setpoint that is
written once and then left alone, so the AC's own thermostat holds the room
overnight instead of the loop nudging it.

- Toggle: `input_boolean.bedrooms_night_fixed_cooling`.
- Setpoint: `input_number.bedrooms_night_fixed_cooling_target`. This value is
  deliberately AC-side, not room-side: it is the room comfort target plus the
  AC-internal-sensor-vs-room calibration offset, measured at the normal
  cooling fan speed. That is why it differs from
  `input_number.bedrooms_summer_night_target` - the two helpers answer
  different questions and one should not be "corrected" to match the other.

### Handover

The branch fires only on these trigger ids:

- `summer_night_fixed_cooling_start` - the 19:30 clock trigger.
- `night_fixed_cooling_toggle_on` - the toggle turning on mid-window, so
  enabling after 19:30 takes effect immediately instead of waiting for the
  next day.
- `night_fixed_cooling_presence_home` - presence returning while the
  window/toggle already hold.

All three are gated on the same conditions: summer season mode
(`climate_mode`), `summer_night_window`, the toggle being on, and not
`hard_away` - a local variable scoped to just this branch's condition and the
engagement-latch tracker below, `hard_away = allow_away_saving and
away_by_presence`. It deliberately drops the `away_by_no_motion` term from
the shared `away` formula (added 2026-08-17, incident below): genuine
presence absence still blocks/breaks the handover, but the household falling
asleep and going still no longer counts as "away" for this branch. The
shared `away` variable itself is untouched everywhere else - daytime relax,
return-boost, LivingR/BedroomB all still use the full formula. On a match
the branch, in order:

1. `climate.set_hvac_mode` to `cool`.
2. `climate.set_temperature` to the fixed setpoint.
3. `climate.set_fan_mode` normalized from `input_number.bedrooms_cooling_fan_mode`
   - the plain helper, deliberately not the boost-resolved `cooling_fan_mode`
     setup variable, because a latched
     [return boost](#return-boost-all-3-rooms-as-of-2026-07-19) fan speed must
     not survive into the night (added 2026-08-15, to close the gap below).
4. `input_boolean.bedrooms_fixed_cooling_engaged` turned on.

The setpoint is written once per handover and is not re-asserted until the
next handover. This is a deliberate write-once contract: the AC's own
thermostat is trusted to hold the room, and nothing polls or re-sends the
setpoint overnight.

### Engagement latch

The three summer comfort branches (cool-when-above-band, coil cool-down,
turn-off-after-cool-down) defer while `bedrooms_fixed_cooling_engaged` is on.
This is a fact-based latch, not a re-check of intent: the branches are
suppressed because the handover already happened, not because the
window/toggle/away conditions currently hold. The latch releases once the
window/toggle/`hard_away` intent stops holding (same `hard_away` as the
handover condition above, not the shared `away`), at which point normal
comfort cycling resumes on its own. Because `hard_away` ignores motion, a
quiet house overnight no longer releases the latch; only the window/toggle
ending or a genuine presence absence does.

### Resolved: motion-quiet drop (2026-08-16/17)

Before the `hard_away` split, both the handover condition and the latch
tracker used the full `away` variable, including `away_by_no_motion`. Because
`away_by_no_motion` is itself gated by `day_air_clean_window` (09:00-23:59),
intersected with `summer_night_window` (19:30-08:30) the bug could only fire
between 19:30 and 23:59, not all night. The latch tracker's condition (`not
(summer_night_window and toggle and not away)`) went true - and turned the
engaged latch off - the moment the whole house sat still for 30+ minutes
within that window. None of the handover's three trigger ids fire on "motion
resumed" (only the 19:30 clock, the toggle flipping on, or a real
presence-home transition), so once dropped the latch stayed off for the rest
of the night and the room silently reverted to full proportional comfort
cycling - the recurring "temperature fluctuates overnight" symptom. Confirmed
live 2026-08-16 23:48:15 (inside the 19:30-23:59 window), coincident with
`was_away` flipping true from motion-quiet with no person not_home/home
transition involved. Fixed by scoping `hard_away` (drops `away_by_no_motion`)
into just the handover condition and the latch tracker; see eval 034.

### Known gap (accepted)

A device-side fan change mid-window - via the IR remote or the MELCloud app -
is not corrected until the next handover trigger. This is the 2026-08-15
incident vector: fan 5 arrived device-side during a 16:00-20:00 MELCloud
staleness window, and neither handover firing that evening touched it, so the
AC idled most of the night with the wrong fan speed. Periodic fan re-assert
was deliberately not added, to preserve the write-once contract above.
Revisit if this recurs.

## Air Cleaning And Coil Cool-Down

The 03:00-06:00 air-clean window is allowed to use `fan_only` with fan 5.
Since the 2026-07-24 calendar guard, this window and the night-off branch are
winter-only - inert March-November. In summer the night is owned instead by
comfort cycling against the night summer target (see Comfort Loop above), and
for BedroomS specifically by the toggle-gated
[Night Fixed Cooling](#night-fixed-cooling-bedrooms) contract, which takes
over from that cycling entirely.

When cooling reaches the configured stop band, the climate should transition to
`fan_only` for the configured coil cool-down duration before turning off. The
cool-down path must not run during active manual override.

Daytime dust fan behavior must only adjust fan speed when the climate is already
running in an appropriate mode. It must not start cooling/heating by itself.

## Operational Rules

- Live patches that affect control behavior must have a tracked script under
  `tools/home-assistant-live/`.
- Any live helper or automation naming decision must be backported to Terraform.
- After patching live automation configs, reload automations and verify the
  loaded config, not only the local Terraform text.
- Verification should include at least:
  - comfort automation contains `not manual_override_active`
  - manual override automation re-applies while active
  - the climate entity reaches the expected HVAC mode, target, and fan mode
  - no duplicate helper family is referenced by active automations

## Known Failure Modes

- A template sync that replaces the setup block without preserving the final
  `{{ ... }}` expression turns conditions into no-op templates.
- A missing `not manual_override_active` guard lets the comfort loop change the
  climate during manual override.
- A manual override automation that only applies on user changes cannot recover
  if the climate state drifts or MELCloud turns the unit off.
- Split helper families make the dashboard, comfort loop, and override loop
  disagree about which mode is active.
- **Xiaomi cloud auth failure freezes room sensors.** The `xiaomi_miot`
  integration polls Xiaomi's cloud; when that session breaks
  (`MiCloudException: "get device udid error"`, code -704220009), it affects
  every cloud-polled sensor on the linked Xiaomi account at once. Affected
  sensors keep reporting their last cached numeric value, with occasional
  `unavailable` flickers back to that same value — "force renew device"
  does not help, since it re-hits the same broken cloud session. Comfort
  automations with no staleness guard will trust the frozen reading
  indefinitely. See [Room Temperature Source](#room-temperature-source) for
  the fluctuation-tracking + worst-case conflict-resolution guard that
  detects and works around this.
- A staleness guard based on `last_changed` alone would miss the failure
  mode above: an `unavailable` flicker back to the *same* cached value still
  resets `last_changed`, even though the underlying reading never actually
  moved. The guard must track genuine value movement (see the fluctuation
  tracker automation), not state-string churn.
- The setup block (all the `{% set %}` lines computing `target`, `effective`,
  `active_cooling_start_delta`, `cooling_fan_mode`, etc.) is duplicated as a
  literal prefix inside every top-level condition and every choose-branch's
  condition/action data - there is no shared `locals`/macro at the live-HA
  level, only in older hand-written Terraform text. A live patch that edits
  "the" setup block by finding just one match (e.g. `cfg.condition[0]`, or
  one branch's `conditions[0]`) silently leaves 20-30 other copies unpatched,
  including copies inside `action` service-call `data` fields (e.g. the
  `dynamic_setpoint` used in `climate.set_temperature`), not just inside
  `condition`/`value_template` keys. This happened twice in one session
  (BedroomB's `away_relax_delta` wiring, then BedroomS's `cooling_fan_mode`
  boost) before the fix: after any setup-block edit, grep the full fetched
  config JSON for the old and new text and confirm the old count is exactly
  zero before saving - do not trust a single successful-looking edit.
