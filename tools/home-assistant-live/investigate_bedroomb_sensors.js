const { rest } = require("./ha_ws_util");

const entities = [
  "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor",
  "sensor.miaomiaoce_t2_5249_battery_level",
  "sensor.miaomiaoce_t2_5249_relative_humidity",
  "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor",
  "sensor.miaomiaoce_t2_faea_battery_level",
  "sensor.miaomiaoce_t2_faea_relative_humidity",
  "sensor.miaomiaoce_t2_1846_temperature_humidity_sensor",
  "sensor.miaomiaoce_t2_1846_battery_level",
  "sensor.v357_spalniag_room_temperature_2",
  "climate.v357_spalniag_2",
  "binary_sensor.motion03",
];

function iso(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

(async () => {
  const states = await rest("/api/states");
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const history = await rest(`/api/history/period/${iso(start)}?end_time=${encodeURIComponent(iso(now))}&filter_entity_id=${entities.join(",")}&minimal_response=false`);

  const byEntity = new Map(states.map((s) => [s.entity_id, s]));
  const histByEntity = new Map();
  for (const series of history) {
    if (!series.length) continue;
    histByEntity.set(series[0].entity_id, series);
  }

  const report = entities.map((entityId) => {
    const state = byEntity.get(entityId);
    const samples = histByEntity.get(entityId) || [];
    const values = samples.map((s) => num(s.state)).filter((v) => v !== null);
    const last5 = samples.slice(-5).map((s) => ({
      state: s.state,
      changed: s.last_changed,
    }));
    return {
      entity_id: entityId,
      friendly_name: state?.attributes?.friendly_name,
      state: state?.state,
      unit: state?.attributes?.unit_of_measurement,
      current_temperature: state?.attributes?.current_temperature,
      target_temperature: state?.attributes?.temperature,
      fan_mode: state?.attributes?.fan_mode,
      hvac_mode: state?.state,
      last_changed: state?.last_changed,
      samples_24h: samples.length,
      min_24h: values.length ? Math.min(...values) : null,
      max_24h: values.length ? Math.max(...values) : null,
      avg_24h: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null,
      last5,
    };
  });

  console.log(JSON.stringify(report, null, 2));
})();
