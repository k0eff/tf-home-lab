const { connectWs, rest } = require("./ha_ws_util");

function findCards(cards, predicate, path = []) {
  const results = [];
  for (let i = 0; i < (cards || []).length; i += 1) {
    const card = cards[i];
    const nextPath = [...path, i];
    if (predicate(card)) results.push({ path: nextPath, card });
    if (card.cards) results.push(...findCards(card.cards, predicate, nextPath));
  }
  return results;
}

async function main() {
  const entities = [
    "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    "climate.v357_spalniag_2",
    "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor",
    "sensor.miaomiaoce_t2_5249_battery_level",
    "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor",
    "sensor.miaomiaoce_t2_faea_battery_level",
    "sensor.v357_spalniag_room_temperature_2",
    "sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor",
    "sensor.miaomiaoce_t2_56fa_battery_level",
    "weather.forecast_home",
    "input_number.bedroomb_target_temperature",
    "input_number.bedroomb_hot_summer_target",
    "input_number.bedroomb_cooling_start_delta",
    "input_number.bedroomb_night_summer_target",
    "input_number.bedroomb_night_cooling_start_delta",
    "input_number.bedroomb_winter_target",
    "input_number.bedroomb_winter_start_delta",
    "input_number.bedroomb_summer_outside_threshold",
    "input_number.bedroomb_winter_outside_threshold",
    "input_number.bedroomb_mild_outside_threshold",
    "input_number.bedroomb_venti_in_offset",
    "input_datetime.bedroomb_night_start",
    "input_datetime.bedroomb_day_start",
    "input_datetime.bedroomb_air_clean_start",
    "input_datetime.bedroomb_air_clean_end",
  ];

  const states = await rest("/api/states");
  const stateMap = Object.fromEntries(states.filter((s) => entities.includes(s.entity_id)).map((s) => [s.entity_id, {
    state: s.state,
    friendly_name: s.attributes?.friendly_name,
    current_temperature: s.attributes?.current_temperature,
    target_temperature: s.attributes?.temperature,
    fan_mode: s.attributes?.fan_mode,
    last_changed: s.last_changed,
  }]));

  const tpl = `{% set primary_room = states('sensor.miaomiaoce_t2_5249_temperature_humidity_sensor') | float(none) %}
{% set primary_battery = states('sensor.miaomiaoce_t2_5249_battery_level') | float(0) %}
{% set secondary_room = states('sensor.miaomiaoce_t2_faea_temperature_humidity_sensor') | float(none) %}
{% set secondary_battery = states('sensor.miaomiaoce_t2_faea_battery_level') | float(0) %}
{% set ac_temp = state_attr('climate.v357_spalniag_2', 'current_temperature') | float(none) %}
{% set outside_venti_raw = states('sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor') | float(none) %}
{% set outside_venti_battery = states('sensor.miaomiaoce_t2_56fa_battery_level') | float(0) %}
{% set outside_weather = state_attr('weather.forecast_home', 'temperature') | float(none) %}
{% set room_sensor_min_battery = states('input_number.bedroomb_room_sensor_min_battery') | float(10) %}
{% set outside_sensor_min_battery = states('input_number.bedroomb_outside_sensor_min_battery') | float(10) %}
{% set outside_venti_offset = states('input_number.bedroomb_venti_in_offset') | float(2) %}
{% set winter_outside_threshold = states('input_number.bedroomb_winter_outside_threshold') | float(8) %}
{% set summer_outside_threshold = states('input_number.bedroomb_summer_outside_threshold') | float(15) %}
{% set mild_outside_threshold = states('input_number.bedroomb_mild_outside_threshold') | float(28) %}
{% set mild_summer_target = states('input_number.bedroomb_target_temperature') | float(23.5) %}
{% set hot_summer_target = states('input_number.bedroomb_hot_summer_target') | float(23.8) %}
{% set night_summer_target = states('input_number.bedroomb_night_summer_target') | float(28) %}
{% set cooling_start_delta = states('input_number.bedroomb_cooling_start_delta') | float(0.4) %}
{% set night_cooling_start_delta = states('input_number.bedroomb_night_cooling_start_delta') | float(0.4) %}
{% set night_start_value = states('input_datetime.bedroomb_night_start') %}
{% set day_start_value = states('input_datetime.bedroomb_day_start') %}
{% set air_clean_start_value = states('input_datetime.bedroomb_air_clean_start') %}
{% set air_clean_end_value = states('input_datetime.bedroomb_air_clean_end') %}
{% set night_start_parts = night_start_value.split(':') %}
{% set day_start_parts = day_start_value.split(':') %}
{% set air_clean_start_parts = air_clean_start_value.split(':') %}
{% set air_clean_end_parts = air_clean_end_value.split(':') %}
{% set night_start_minutes = (night_start_parts[0] | int) * 60 + (night_start_parts[1] | int) %}
{% set day_start_minutes = (day_start_parts[0] | int) * 60 + (day_start_parts[1] | int) %}
{% set air_clean_start_minutes = (air_clean_start_parts[0] | int) * 60 + (air_clean_start_parts[1] | int) %}
{% set air_clean_end_minutes = (air_clean_end_parts[0] | int) * 60 + (air_clean_end_parts[1] | int) %}
{% set minutes_now = now().hour * 60 + now().minute %}
{% set night_sleep_window = (minutes_now >= night_start_minutes and minutes_now < day_start_minutes) if night_start_minutes < day_start_minutes else (minutes_now >= night_start_minutes or minutes_now < day_start_minutes) %}
{% set night_air_clean_window = (minutes_now >= air_clean_start_minutes and minutes_now < air_clean_end_minutes) if air_clean_start_minutes < air_clean_end_minutes else (minutes_now >= air_clean_start_minutes or minutes_now < air_clean_end_minutes) %}
{% if outside_venti_battery > outside_sensor_min_battery and outside_venti_raw is not none %}
  {% set outside_source = 'venti_in_adjusted' %}
  {% set outside = outside_venti_raw - outside_venti_offset %}
{% elif outside_weather is not none %}
  {% set outside_source = 'weather_forecast_home' %}
  {% set outside = outside_weather %}
{% else %}
  {% set outside_source = 'none' %}
  {% set outside = none %}
{% endif %}
{% set climate_mode = 'winter' if outside is not none and outside <= winter_outside_threshold else 'summer' if outside is not none and outside >= summer_outside_threshold else 'neutral' %}
{% if primary_battery > room_sensor_min_battery and primary_room is not none %}
  {% set source = 'primary_room_sensor' %}
  {% set effective = primary_room %}
{% elif secondary_battery > room_sensor_min_battery and secondary_room is not none %}
  {% set source = 'ceiling_room_sensor' %}
  {% set effective = secondary_room %}
{% else %}
  {% set source = 'climate_fallback' %}
  {% set effective = ac_temp %}
{% endif %}
{% set day_summer_target = mild_summer_target if climate_mode == 'summer' and outside is not none and outside < mild_outside_threshold else hot_summer_target if climate_mode == 'summer' else none %}
{% set target = night_summer_target if night_sleep_window and climate_mode == 'summer' else day_summer_target if climate_mode == 'summer' else none %}
{% set active_cooling_start_delta = night_cooling_start_delta if night_sleep_window else cooling_start_delta %}
{{ dict(now=now().isoformat(), minutes_now=minutes_now, night_sleep_window=night_sleep_window, night_air_clean_window=night_air_clean_window, outside=outside, outside_source=outside_source, climate_mode=climate_mode, source=source, effective=effective, target=target, active_cooling_start_delta=active_cooling_start_delta, should_cool=(not night_air_clean_window and climate_mode == 'summer' and effective is not none and target is not none and effective > target + active_cooling_start_delta), current_hvac=states('climate.v357_spalniag_2'), current_setpoint=state_attr('climate.v357_spalniag_2','temperature'), ac_temp=ac_temp) }}`;

  const rendered = await rest("/api/template", "POST", { template: tpl });

  const ws = await connectWs();
  let id = 1;
  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  ws.close();
  const bed = lovelace.result.views.find((v) => v.path === "bedb" || v.title === "BedB Tune");
  const scheduleCards = findCards(bed?.cards, (c) => c.title === "Schedule");
  const allViewTitles = lovelace.result.views.map((v) => ({ title: v.title, path: v.path, icon: v.icon }));

  console.log(JSON.stringify({
    stateMap,
    rendered,
    bedDashboard: {
      exists: Boolean(bed),
      title: bed?.title,
      path: bed?.path,
      scheduleCards: scheduleCards.map((x) => x.card),
      viewTitles: allViewTitles,
    },
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
