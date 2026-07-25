// Incident 2026-07-24/25 (found via /investigate): BedroomS AC would not
// turn on overnight 00:30-01:42 local despite the comfort-band automation
// being on and the room climbing 23.8C -> 24.0C. Root cause traced through
// 5 automation traces (all 9 action branches evaluated false, including
// branches that only require climate_mode == 'summer' with no temperature
// check) cross-referenced against sensor.miaomiaoce_t2_56fa_temperature
// (Venti In 7) history:
//
//   outside = venti_raw - venti_in_offset (2.0C)
//   climate_mode = 'winter' if outside <= 8 else 'summer' if outside >= 15
//                  else 'neutral'
//
// The venti/ERV intake sensor naturally cools overnight (a normal diurnal
// swing, not real outdoor weather - it stayed alive and battery 100% the
// whole time, this isn't the dead-entity bug from earlier the same day).
// venti_raw drifted from ~17-18C in the evening down to ~14-16C around
// midnight-to-dawn, which pushed the adjusted `outside` below the 15C
// summer threshold for hours (20:55:53 UTC through past 04:58:53 UTC on
// 2026-07-25, with one brief bounce back). In 'neutral' mode every action
// branch requires climate_mode == 'summer' or 'winter' - none matches, so
// the automation's `choose` action is a silent no-op regardless of how hot
// the room gets. Same underlying `outside` chain is shared by LivingR and
// BedroomB (each has their own venti_in_offset/thresholds), so this class
// of bug applies to all 3 rooms, not just BedroomS.
//
// User confirmed the intended design after this investigation: climate_mode
// must be determined ONLY by calendar month - Dec/Jan/Feb = winter,
// Mar-Nov inclusive = summer - never by any temperature reading (outside,
// inside, or otherwise). This removes the neutral state entirely, so the
// no-op fallthrough can no longer happen.
//
// Fix: replaced the temperature-threshold climate_mode formula with
// `{% set climate_mode = 'winter' if now().month in [12, 1, 2] else
// 'summer' %}` in all 3 rooms' comfort-band automations (28 occurrences
// each, verified count before/after). The `outside` variable itself is
// UNCHANGED and still computed/used elsewhere (mild vs hot day-target
// selection, room/AC disagreement worst-case check) - only climate_mode's
// source changed.
//
// Also re-enabled automation.test_aircon_bedrooms_room_sensor_comfort_band,
// which had been manually disabled during the incident (01:42 local
// 2026-07-25) and never turned back on.
//
// Run: node apply_climate_mode_calendar_only.js

const fs = require("fs");
const path = require("path");
const { rest } = require("./ha_ws_util");

const OLD_FORMULA =
  "{% set climate_mode = 'winter' if outside is not none and outside <= winter_outside_threshold else 'summer' if outside is not none and outside >= summer_outside_threshold else 'neutral' %}";
const NEW_FORMULA = "{% set climate_mode = 'winter' if now().month in [12, 1, 2] else 'summer' %}";

const ROOMS = [
  { id: "1770077000010", entity: "automation.test_aircon_livingr_room_sensor_comfort_band" },
  { id: "1770077000021", entity: "automation.test_aircon_bedroomb_room_sensor_comfort_band" },
  { id: "1770077000061", entity: "automation.test_aircon_bedrooms_room_sensor_comfort_band" },
];

async function main() {
  for (const room of ROOMS) {
    const config = await rest(`/api/config/automation/config/${room.id}`, "GET");
    let raw = JSON.stringify(config);
    raw = raw.split(OLD_FORMULA).join(NEW_FORMULA);
    await rest(`/api/config/automation/config/${room.id}`, "POST", JSON.parse(raw));
  }
  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/turn_on", "POST", {
    entity_id: "automation.test_aircon_bedrooms_room_sensor_comfort_band",
  });

  const states = await rest("/api/states", "GET");
  for (const room of ROOMS) {
    const e = states.find((s) => s.entity_id === room.entity);
    console.log(room.entity, "->", e && e.state);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
