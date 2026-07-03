# Home Assistant Climate Control Contract

This document describes the intended behavior for the LivingR and BedroomB
climate programs. Home Assistant live helpers are the runtime source of truth
for tunable parameters. Terraform backports those settings and automations so
the setup can be recreated, reviewed, and versioned.

## Scope

- LivingR and BedroomB use the same control algorithm.
- Room-specific differences should be data only: entity IDs, sensor priority,
  targets, thresholds, fan modes, and schedule helpers.
- Dashboards are the control surface for runtime parameters.
- Terraform must not introduce a second set of helper names for the same
  concept.

## Canonical Helper Names

Each room uses the room prefix, either `livingr` or `bedroomb`.

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

## Air Cleaning And Coil Cool-Down

The 03:00-06:00 air-clean window is allowed to use `fan_only` with fan 5 in both
seasons.

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
