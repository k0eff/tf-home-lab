const { rest } = require("./ha_ws_util");

const entities = [
  "automation.test_aircon_livingr_room_sensor_comfort_band",
  "climate.hol_2",
  "climate.hol",
  "switch.hol_power",
  "sensor.miaomiaoce_t2_1228_temperature_humidity_sensor",
  "sensor.miaomiaoce_t2_1228_battery_level",
  "sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor",
  "sensor.miaomiaoce_t2_56fa_battery_level",
  "input_number.livingr_target_temperature",
  "input_number.livingr_hot_summer_target",
  "input_number.livingr_cooling_start_delta",
  "input_datetime.livingr_day_start",
  "input_datetime.livingr_night_start",
];

async function main() {
  const states = await rest("/api/states");
  const snapshot = Object.fromEntries(states.filter((s) => entities.includes(s.entity_id)).map((s) => [s.entity_id, {
    state: s.state,
    friendly_name: s.attributes?.friendly_name,
    current_temperature: s.attributes?.current_temperature,
    target_temperature: s.attributes?.temperature,
    fan_mode: s.attributes?.fan_mode,
    last_changed: s.last_changed,
    last_updated: s.last_updated,
  }]));
  const tpl = `{% set room = states('sensor.miaomiaoce_t2_1228_temperature_humidity_sensor') | float(none) %}
{% set ac_temp = state_attr('climate.hol_2','current_temperature') | float(none) %}
{% set outside = states('sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor') | float(none) - (states('input_number.livingr_venti_in_offset') | float(2)) %}
{% set target = states('input_number.livingr_target_temperature') | float(23.9) if outside < (states('input_number.livingr_mild_outside_threshold') | float(28)) else states('input_number.livingr_hot_summer_target') | float(24) %}
{% set delta = states('input_number.livingr_cooling_start_delta') | float(0.4) %}
{{ dict(now=now().isoformat(), automation=states('automation.test_aircon_livingr_room_sensor_comfort_band'), climate=states('climate.hol_2'), power=states('switch.hol_power'), room=room, ac_temp=ac_temp, outside=outside, target=target, delta=delta, should_cool=(room is not none and room >= target + delta)) }}`;
  const rendered = await rest("/api/template", "POST", { template: tpl });
  console.log(JSON.stringify({ snapshot, rendered }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
