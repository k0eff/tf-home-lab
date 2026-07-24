// Same root cause as apply_bedrooms_room_sensor_entity_fix.js: the Stage 5 HA
// upgrade (2026-07-21) caused xiaomi_miot to split the old combined
// sensor.*_temperature_humidity_sensor entity into a separate, live
// sensor.*_temperature entity for every miaomiaoce.sensor_ht.t2 device. The old
// combined entity died platform-wide on 2026-07-22 08:10 and never recovered.
//
// The "My Dash" Lovelace dashboard (url_path "my-dash") still referenced the
// dead combined entity_id directly in its cards - 52 occurrences across 15
// devices (every room's temperature card). Found and fixed 2026-07-24 when the
// user asked to also fix the temperature panel on that dashboard, after the
// automation-side fix surfaced the same underlying bug.
//
// Fix: plain string rename `miaomiaoce_t2_<id>_temperature_humidity_sensor` ->
// `miaomiaoce_t2_<id>_temperature` for all 15 device ids present in the
// dashboard. Verified all 15 new entities live (<20min old) before applying.
// No humidity display was lost - the old combined entity never exposed a
// humidity attribute either (device_class was always "temperature" only), so
// this was a pure 1:1 entity_id swap.
//
// my_dash_lovelace_config.json is the exact config as saved via
// lovelace/config/save on 2026-07-24 - re-run this script any time to restore
// it (e.g. after fat-fingering a card in the UI, or if the dashboard is ever
// recreated in a config restore that predates this fix).
//
// Run: node apply_my_dash_temperature_entity_fix.js

const fs = require("fs");
const path = require("path");
const { connectWs } = require("./ha_ws_util");

const URL_PATH = "my-dash";
const CONFIG_PATH = path.join(__dirname, "my_dash_lovelace_config.json");

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const ws = await connectWs();
  const res = await ws.request({ id: 1, type: "lovelace/config/save", url_path: URL_PATH, config });
  ws.close();
  if (!res.success) throw new Error(JSON.stringify(res));
  console.log("applied. lovelace/config/save success:", res.success);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
