// Companion fix to apply_livingr_bedroomb_room_sensor_entity_fix.js, found
// the same session (2026-07-24): `[TEST] AirCon - room sensor fluctuation
// tracker` (id 1770077000099) still triggered on the dead
// sensor.*_temperature_humidity_sensor entities for ALL THREE rooms
// (LivingR 1228, BedroomB primary 5249, BedroomB secondary/ceiling faea,
// BedroomS f7cc). Since those entities have been permanently `unavailable`
// since 2026-07-22 08:10, this tracker never fired again, so
// input_datetime.*_room_last_moved stayed frozen at 2026-07-21/22 forever -
// which made every room's `room_stale` check permanently true and forced
// every comfort-band automation onto its `climate_fallback` path (the AC
// unit's own, less accurate, near-unit sensor) instead of the real room
// sensor, even after the entity_id itself was fixed elsewhere.
//
// Fix: renamed the 4 dead entity_ids in this automation's trigger list to
// their live `_temperature` replacements (1:1 swap, same as the other
// fixes - the action body references `trigger.to_state.state` generically,
// so only the trigger list needed renaming, 1 occurrence each).
//
// Also manually stamped input_number.*_last_seen_value and
// input_datetime.*_last_moved to the current real sensor readings right
// after applying this fix, since the tracker itself only updates them on
// the *next* real state change - manual stamping unblocked room_healthy
// immediately instead of waiting for the next BLE report cycle.
//
// Run: node apply_room_sensor_fluctuation_tracker_entity_fix.js

const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000099";

const RENAMES = [
  ["sensor.miaomiaoce_t2_1228_temperature_humidity_sensor", "sensor.miaomiaoce_t2_1228_temperature"],
  ["sensor.miaomiaoce_t2_5249_temperature_humidity_sensor", "sensor.miaomiaoce_t2_5249_temperature"],
  ["sensor.miaomiaoce_t2_faea_temperature_humidity_sensor", "sensor.miaomiaoce_t2_faea_temperature"],
  ["sensor.miaomiaoce_t2_f7cc_temperature_humidity_sensor", "sensor.miaomiaoce_t2_f7cc_temperature"],
];

const STAMP_MAP = [
  ["sensor.miaomiaoce_t2_1228_temperature", "input_number.livingr_room_last_seen_value", "input_datetime.livingr_room_last_moved"],
  ["sensor.miaomiaoce_t2_5249_temperature", "input_number.bedroomb_room_primary_last_seen_value", "input_datetime.bedroomb_room_primary_last_moved"],
  ["sensor.miaomiaoce_t2_faea_temperature", "input_number.bedroomb_room_secondary_last_seen_value", "input_datetime.bedroomb_room_secondary_last_moved"],
];

async function main() {
  const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
  let raw = JSON.stringify(config);
  for (const [oldE, newE] of RENAMES) {
    raw = raw.split(oldE).join(newE);
  }
  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", JSON.parse(raw));
  await rest("/api/services/automation/reload", "POST", {});

  const states = await rest("/api/states", "GET");
  for (const [sensorId, lastSeenId, lastMovedId] of STAMP_MAP) {
    const s = states.find((x) => x.entity_id === sensorId);
    const val = parseFloat(s.state);
    await rest("/api/services/input_number/set_value", "POST", { entity_id: lastSeenId, value: val });
    await rest("/api/services/input_datetime/set_datetime", "POST", { entity_id: lastMovedId, timestamp: Date.now() / 1000 });
    console.log(sensorId, "=", val, "-> stamped", lastMovedId);
  }

  const after = await rest("/api/states", "GET");
  const e = after.find((s) => s.entity_id === "automation.test_aircon_room_sensor_fluctuation_tracker");
  console.log("tracker entity state:", e && e.state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
