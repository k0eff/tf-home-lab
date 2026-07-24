// Incident 2026-07-24 (found while investigating why LivingR and BedroomB
// climate units were both `off` during brutal summer heat, despite their
// comfort-band automations being `on`): same root cause as BedroomS's
// earlier fix (apply_bedrooms_room_sensor_entity_fix.js) - the Stage 5 HA
// Core upgrade (2026-07-21) caused xiaomi_miot to split the old combined
// sensor.*_temperature_humidity_sensor entity into a separate, live
// sensor.*_temperature entity for every miaomiaoce.sensor_ht.t2 device. The
// old combined entities died platform-wide on 2026-07-22 08:10 and never
// recovered.
//
// LivingR and BedroomB's comfort-band automations still hardcoded the dead
// combined entity_ids for their room sensor(s) AND for the shared outside
// proxy sensor (Venti In 7, id 56fa - referenced by all 3 rooms). With the
// outside proxy dead, `outside` fell through to weather.forecast_home,
// which for unrelated reasons is currently reporting ~13.7C (looks like a
// forecast/location glitch, not real conditions) - well inside the
// 8-15C "neutral" band, so climate_mode resolved to 'neutral' instead of
// 'summer' and the entire comfort-cooling branch never matched, regardless
// of how hot the room actually was. This is a compounding bug: dead sensor
// -> wrong outside source -> wrong climate_mode -> no cooling at all.
//
// Fix: renamed all `_temperature_humidity_sensor` -> `_temperature` for
// LivingR's room sensor (1228) and BedroomB's two room sensors (5249
// primary, faea secondary/ceiling), plus the shared outside proxy (56fa)
// in both automations. Same 1:1 entity_id swap as the BedroomS fix - both
// old and new entities are bare numeric values, no attribute-shape change.
//
// Applied directly via REST against the live automation configs (bypasses
// Terraform, same pattern as the BedroomS live fixes) - main.tf was
// updated separately with the same renames to keep the Terraform source in
// sync and prevent a future `terraform apply` from reverting this.
//
// After applying, both automations were force-triggered via
// automation/trigger so the fix took effect immediately instead of waiting
// for the next periodic_check (every 5 min).
//
// Run: node apply_livingr_bedroomb_room_sensor_entity_fix.js

const fs = require("fs");
const path = require("path");
const { rest } = require("./ha_ws_util");

const ROOMS = [
  {
    id: "1770077000010",
    entity: "automation.test_aircon_livingr_room_sensor_comfort_band",
    renames: [
      ["sensor.miaomiaoce_t2_1228_temperature_humidity_sensor", "sensor.miaomiaoce_t2_1228_temperature"],
      ["sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor", "sensor.miaomiaoce_t2_56fa_temperature"],
    ],
  },
  {
    id: "1770077000021",
    entity: "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    renames: [
      ["sensor.miaomiaoce_t2_5249_temperature_humidity_sensor", "sensor.miaomiaoce_t2_5249_temperature"],
      ["sensor.miaomiaoce_t2_faea_temperature_humidity_sensor", "sensor.miaomiaoce_t2_faea_temperature"],
      ["sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor", "sensor.miaomiaoce_t2_56fa_temperature"],
    ],
  },
];

async function main() {
  for (const room of ROOMS) {
    const config = await rest(`/api/config/automation/config/${room.id}`, "GET");
    let raw = JSON.stringify(config);
    for (const [oldE, newE] of room.renames) {
      raw = raw.split(oldE).join(newE);
    }
    await rest(`/api/config/automation/config/${room.id}`, "POST", JSON.parse(raw));
  }
  await rest("/api/services/automation/reload", "POST", {});
  for (const room of ROOMS) {
    await rest("/api/services/automation/trigger", "POST", { entity_id: room.entity });
  }
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
