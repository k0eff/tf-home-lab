const { rest } = require("./ha_ws_util");

const TEMPLATE = String.raw`
{% set primary_room = states('sensor.miaomiaoce_t2_5249_temperature_humidity_sensor') | float(none) %}
{% set primary_battery = states('sensor.miaomiaoce_t2_5249_battery_level') | float(0) %}
{% set secondary_room = states('sensor.miaomiaoce_t2_faea_temperature_humidity_sensor') | float(none) %}
{% set secondary_battery = states('sensor.miaomiaoce_t2_faea_battery_level') | float(0) %}
{% set ac_temp = state_attr('climate.v357_spalniag_2', 'current_temperature') | float(none) %}
{% set outside_venti_raw = states('sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor') | float(none) %}
{% set outside_venti_battery = states('sensor.miaomiaoce_t2_56fa_battery_level') | float(0) %}
{% set outside_weather = state_attr('weather.forecast_home', 'temperature') | float(none) %}
{% set outside_venti_device = states('sensor.venti_outside_temperature') | float(none) %}
{% set room_sensor_min_battery = states('input_number.bedroomb_room_sensor_min_battery') | float(10) %}
{% set outside_sensor_min_battery = states('input_number.bedroomb_outside_sensor_min_battery') | float(10) %}
{% set outside_venti_offset = states('input_number.bedroomb_venti_in_offset') | float(2) %}
{% set winter_outside_threshold = states('input_number.bedroomb_winter_outside_threshold') | float(8) %}
{% set summer_outside_threshold = states('input_number.bedroomb_summer_outside_threshold') | float(15) %}
{% set mild_outside_threshold = states('input_number.bedroomb_mild_outside_threshold') | float(28) %}
{% set mild_summer_target = states('input_number.bedroomb_target_temperature') | float(23.5) %}
{% set hot_summer_target = states('input_number.bedroomb_hot_summer_target') | float(23.8) %}
{% set winter_target = states('input_number.bedroomb_winter_target') | float(22) %}
{% set night_summer_target = states('input_number.bedroomb_night_summer_target') | float(28) %}
{% set night_winter_target = states('input_number.bedroomb_night_winter_target') | float(19) %}
{% set night_cooling_start_delta = states('input_number.bedroomb_night_cooling_start_delta') | float(0.4) %}
{% set night_winter_start_delta = states('input_number.bedroomb_night_winter_start_delta') | float(0.5) %}
{% set cooling_start_delta = states('input_number.bedroomb_cooling_start_delta') | float(0.4) %}
{% set winter_start_delta = states('input_number.bedroomb_winter_start_delta') | float(0.5) %}
{% set cooling_overshoot = states('input_number.bedroomb_cooling_overshoot') | float(0.2) %}
{% set cooling_stop_room_temp = states('input_number.bedroomb_cooling_stop_room_temp') | float(0) %}
{% set cooling_fan_mode = states('input_number.bedroomb_cooling_fan_mode') | int(2) %}
{% set night_start_value = states('input_datetime.bedroomb_night_start') if states('input_datetime.bedroomb_night_start') not in ['unknown', 'unavailable', 'none'] else '00:30:00' %}
{% set day_start_value = states('input_datetime.bedroomb_day_start') if states('input_datetime.bedroomb_day_start') not in ['unknown', 'unavailable', 'none'] else '08:30:00' %}
{% set air_clean_start_value = states('input_datetime.bedroomb_air_clean_start') if states('input_datetime.bedroomb_air_clean_start') not in ['unknown', 'unavailable', 'none'] else '03:00:00' %}
{% set air_clean_end_value = states('input_datetime.bedroomb_air_clean_end') if states('input_datetime.bedroomb_air_clean_end') not in ['unknown', 'unavailable', 'none'] else '06:00:00' %}
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
{% elif outside_venti_device is not none %}
  {% set outside_source = 'venti_device_outside' %}
  {% set outside = outside_venti_device %}
{% else %}
  {% set outside_source = 'none' %}
  {% set outside = none %}
{% endif %}
{% set climate_mode = 'winter' if outside is not none and outside <= winter_outside_threshold else 'summer' if outside is not none and outside >= summer_outside_threshold else 'neutral' %}
{% if primary_battery > room_sensor_min_battery and primary_room is not none %}
  {% set source = 'primary_room_sensor' %}
  {% set effective = primary_room %}
{% elif secondary_battery > room_sensor_min_battery and secondary_room is not none %}
  {% set source = 'secondary_room_sensor' %}
  {% set effective = secondary_room %}
{% else %}
  {% set source = 'climate_fallback' %}
  {% set effective = ac_temp %}
{% endif %}
{% set manual_until = states('input_datetime.bedroomb_manual_override_until') %}
{% set manual_active = is_state('input_boolean.bedroomb_manual_override', 'on') and manual_until not in ['unknown', 'unavailable', 'none'] and as_timestamp(manual_until, 0) > as_timestamp(now()) %}
{% set day_summer_target = mild_summer_target if climate_mode == 'summer' and outside is not none and outside < mild_outside_threshold else hot_summer_target if climate_mode == 'summer' else none %}
{% set target = night_summer_target if night_sleep_window and climate_mode == 'summer' else day_summer_target if climate_mode == 'summer' else night_winter_target if night_sleep_window and climate_mode == 'winter' else winter_target if climate_mode == 'winter' else none %}
{% set active_cooling_start_delta = night_cooling_start_delta if night_sleep_window else cooling_start_delta %}
{% set active_winter_start_delta = night_winter_start_delta if night_sleep_window else winter_start_delta %}
{% set learned_overshoot = [0, [1, cooling_overshoot] | min] | max %}
{% set error = effective - target if effective is not none and target is not none else none %}
{% set dynamic_setpoint = ([16, [31, ((ac_temp - error) * 2) | round(0) / 2] | min] | max) if ac_temp is not none and error is not none else none %}
{% set should_cool = not manual_active and climate_mode == 'summer' and target is not none and effective is not none and effective > target + active_cooling_start_delta and not (night_sleep_window and not night_air_clean_window and not true) %}
{% set should_cooldown = not manual_active and states('climate.v357_spalniag_2') == 'cool' and climate_mode == 'summer' and target is not none and effective is not none and effective <= target + learned_overshoot %}
{{ {
  "now": now().isoformat(),
  "climate_state": states('climate.v357_spalniag_2'),
  "climate_current_temperature": ac_temp,
  "climate_target_temperature": state_attr('climate.v357_spalniag_2', 'temperature'),
  "climate_fan_mode": state_attr('climate.v357_spalniag_2', 'fan_mode'),
  "program_requested": states('input_boolean.bedroomb_program_requested'),
  "manual_active": manual_active,
  "manual_until": manual_until,
  "outside_source": outside_source,
  "outside": outside,
  "outside_weather": outside_weather,
  "outside_venti_raw": outside_venti_raw,
  "outside_venti_battery": outside_venti_battery,
  "climate_mode": climate_mode,
  "source": source,
  "primary_room": primary_room,
  "primary_battery": primary_battery,
  "secondary_room": secondary_room,
  "secondary_battery": secondary_battery,
  "effective": effective,
  "target": target,
  "mild_summer_target": mild_summer_target,
  "hot_summer_target": hot_summer_target,
  "night_summer_target": night_summer_target,
  "night_sleep_window": night_sleep_window,
  "night_air_clean_window": night_air_clean_window,
  "cooling_start_delta": cooling_start_delta,
  "night_cooling_start_delta": night_cooling_start_delta,
  "active_cooling_start_delta": active_cooling_start_delta,
  "cooling_overshoot": learned_overshoot,
  "cooling_stop_room_temp": cooling_stop_room_temp,
  "cooling_fan_mode": cooling_fan_mode,
  "error": error,
  "dynamic_setpoint": dynamic_setpoint,
  "should_cool": should_cool,
  "should_cooldown": should_cooldown
} | tojson }}
`;

async function main() {
  const rendered = await rest("/api/template", "POST", { template: TEMPLATE });
  const result = typeof rendered === "string" ? JSON.parse(rendered) : rendered;
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
