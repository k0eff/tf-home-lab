const { rest } = require("./ha_ws_util");

function iso(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function main() {
  const now = new Date();
  const start = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const ids = [
    "climate.hol_2",
    "switch.hol_power",
    "automation.test_aircon_livingr_room_sensor_comfort_band",
    "sensor.miaomiaoce_t2_1228_temperature_humidity_sensor",
  ];
  const history = await rest(`/api/history/period/${iso(start)}?end_time=${encodeURIComponent(iso(now))}&filter_entity_id=${ids.join(",")}&minimal_response=false`);
  const out = {};
  for (const series of history) {
    if (!series.length) continue;
    out[series[0].entity_id] = series.slice(-15).map((s) => ({
      state: s.state,
      changed: s.last_changed,
      updated: s.last_updated,
      temp: s.attributes?.temperature,
      current: s.attributes?.current_temperature,
      fan: s.attributes?.fan_mode,
    }));
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
