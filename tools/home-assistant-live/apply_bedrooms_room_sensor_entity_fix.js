// Incident 2026-07-24 (found while investigating why comfort-band automation
// was disabled): the room sensor (BdrmS2) and outside-proxy sensor (Venti In 7)
// both looked "dead" - their sensor.*_temperature_humidity_sensor entities have
// been `unavailable` since 2026-07-22 08:10, i.e. one day after the Stage 5 HA
// Core upgrade (2026.4.4 -> 2026.7.2, see memory: ha-stage5-upgrade-complete).
//
// Root cause: this is a platform-wide xiaomi_miot regression, not a dead device
// or dead battery. EVERY miaomiaoce.sensor_ht.t2 device on this instance (all
// ~15 of them, every room) lost its old combined sensor.*_temperature_humidity_sensor
// entity at the exact same second. The integration now reports temperature via a
// separate, per-property sensor.*_temperature entity instead - and that entity IS
// alive and updating normally (confirmed live: BdrmS2 f7cc_temperature = 24.1C,
// Venti In 7 56fa_temperature = 17.3C, both <10 min old at investigation time).
//
// This automation's config (bedrooms_comfort_band.json) still hardcoded the old,
// now-permanently-dead entity_id in its trigger and condition templates (29
// occurrences each for the room sensor and the outside proxy). It had been
// silently running on stale data for ~2 days before being manually disabled.
//
// Fix: renamed all `_f7cc_temperature_humidity_sensor` -> `_f7cc_temperature` and
// `_56fa_temperature_humidity_sensor` -> `_56fa_temperature` in the automation
// config (plain string replace, both old and new entities only ever reported a
// bare numeric temperature - no attribute-shape change, drop-in compatible with
// the existing `| float(none)` Jinja parsing).
//
// NOT YET CHECKED: whether other rooms' comfort-band automations (BedroomB,
// living room, etc.) reference their own now-dead combined entities the same
// way - this fix only covers BedroomS. Flagged for a follow-up sweep.
//
// Run: node apply_bedrooms_room_sensor_entity_fix.js

const fs = require("fs");
const path = require("path");
const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000061";
const CONFIG_PATH = path.join(__dirname, "bedrooms_comfort_band.json");

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (config.id !== AUTOMATION_ID) {
    throw new Error(`config id ${config.id} does not match expected ${AUTOMATION_ID}`);
  }

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", config);
  await rest("/api/services/automation/reload", "POST", {});

  const states = await rest("/api/states", "GET");
  const entity = states.find(
    (s) => s.entity_id === "automation.test_aircon_bedrooms_room_sensor_comfort_band"
  );
  console.log("applied. entity state:", entity && entity.state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
