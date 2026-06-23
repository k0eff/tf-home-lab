const { rest } = require("./ha_ws_util");

function buildSetup(prefix) {
  return `{% set ${prefix === "livingr" ? "room" : "primary_room"} = states('sensor.${prefix === "livingr" ? "miaomiaoce_t2_1228" : "miaomiaoce_t2_5249"}_temperature_humidity_sensor') | float(none) %}
${prefix === "bedroomb" ? "{% set primary_battery = states('sensor.miaomiaoce_t2_5249_battery_level') | float(0) %}\n{% set secondary_room = states('sensor.miaomiaoce_t2_faea_temperature_humidity_sensor') | float(none) %}\n{% set secondary_battery = states('sensor.miaomiaoce_t2_faea_battery_level') | float(0) %}" : "{% set battery = states('sensor.miaomiaoce_t2_1228_battery_level') | float(0) %}"}
{% set ac_temp = state_attr('climate.${prefix === "livingr" ? "hol_2" : "v357_spalniag_2"}', 'current_temperature') | float(none) %}
{% set outside_venti_raw = states('sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor') | float(none) %}
{% set outside_venti_battery = states('sensor.miaomiaoce_t2_56fa_battery_level') | float(0) %}
{% set outside_weather = state_attr('weather.forecast_home', 'temperature') | float(none) %}
{% set outside_venti_device = states('sensor.venti_outside_temperature') | float(none) %}
{% set room_sensor_min_battery = states('input_number.${prefix}_room_sensor_min_battery') | float(10) %}
{% set outside_sensor_min_battery = states('input_number.${prefix}_outside_sensor_min_battery') | float(10) %}
{% set outside_venti_offset = states('input_number.${prefix}_venti_in_offset') | float(2) %}
{% set winter_outside_threshold = states('input_number.${prefix}_winter_outside_threshold') | float(8) %}
{% set summer_outside_threshold = states('input_number.${prefix}_summer_outside_threshold') | float(15) %}
{% set mild_outside_threshold = states('input_number.${prefix}_mild_outside_threshold') | float(28) %}
{% set mild_summer_target = states('input_number.${prefix}_target_temperature') | float(${prefix === "livingr" ? "23.9" : "23.5"}) %}
{% set hot_summer_target = states('input_number.${prefix}_hot_summer_target') | float(${prefix === "livingr" ? "24.0" : "23.8"}) %}
{% set winter_target = states('input_number.${prefix}_winter_target') | float(22) %}
{% set night_summer_target = states('input_number.${prefix}_${prefix === "livingr" ? "summer_night_target" : "night_summer_target"}') | float(${prefix === "livingr" ? "30" : "28"}) %}
{% set night_winter_target = states('input_number.${prefix}_${prefix === "livingr" ? "winter_night_target" : "night_winter_target"}') | float(19) %}
{% set night_cooling_start_delta = states('input_number.${prefix}_night_cooling_start_delta') | float(0.4) %}
{% set night_winter_start_delta = states('input_number.${prefix}_night_winter_start_delta') | float(0.5) %}
{% set cooling_start_delta = states('input_number.${prefix}_cooling_start_delta') | float(0.4) %}
{% set winter_start_delta = states('input_number.${prefix}_winter_start_delta') | float(0.5) %}
{% set coil_cooldown_minutes = states('input_number.${prefix}_coil_cooldown_minutes') | float(7) %}
{% set cooling_fan_mode = states('input_number.${prefix}_cooling_fan_mode') | int(2) %}
{% set ${prefix}_night_start_value = states('input_datetime.${prefix}_night_start') if states('input_datetime.${prefix}_night_start') not in ['unknown', 'unavailable', 'none'] else '00:30:00' %}
{% set ${prefix}_day_start_value = states('input_datetime.${prefix}_day_start') if states('input_datetime.${prefix}_day_start') not in ['unknown', 'unavailable', 'none'] else '08:30:00' %}
{% set ${prefix}_air_clean_start_value = states('input_datetime.${prefix}_air_clean_start') if states('input_datetime.${prefix}_air_clean_start') not in ['unknown', 'unavailable', 'none'] else '03:00:00' %}
{% set ${prefix}_air_clean_end_value = states('input_datetime.${prefix}_air_clean_end') if states('input_datetime.${prefix}_air_clean_end') not in ['unknown', 'unavailable', 'none'] else '06:00:00' %}
{% set ${prefix}_night_start_parts = ${prefix}_night_start_value.split(':') %}
{% set ${prefix}_day_start_parts = ${prefix}_day_start_value.split(':') %}
{% set ${prefix}_air_clean_start_parts = ${prefix}_air_clean_start_value.split(':') %}
{% set ${prefix}_air_clean_end_parts = ${prefix}_air_clean_end_value.split(':') %}
{% set night_start_minutes = (${prefix}_night_start_parts[0] | int) * 60 + (${prefix}_night_start_parts[1] | int) %}
{% set day_start_minutes = (${prefix}_day_start_parts[0] | int) * 60 + (${prefix}_day_start_parts[1] | int) %}
{% set air_clean_start_minutes = (${prefix}_air_clean_start_parts[0] | int) * 60 + (${prefix}_air_clean_start_parts[1] | int) %}
{% set air_clean_end_minutes = (${prefix}_air_clean_end_parts[0] | int) * 60 + (${prefix}_air_clean_end_parts[1] | int) %}
{% set minutes_now = now().hour * 60 + now().minute %}
{% set night_sleep_window = (minutes_now >= night_start_minutes and minutes_now < day_start_minutes) if night_start_minutes < day_start_minutes else (minutes_now >= night_start_minutes or minutes_now < day_start_minutes) %}
{% set night_air_clean_window = (minutes_now >= air_clean_start_minutes and minutes_now < air_clean_end_minutes) if air_clean_start_minutes < air_clean_end_minutes else (minutes_now >= air_clean_start_minutes or minutes_now < air_clean_end_minutes) %}
{% set night_window = night_air_clean_window %}
{% set day_air_clean_window = minutes_now >= day_start_minutes and minutes_now <= 1439 %}
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
${prefix === "bedroomb"
? "{% set bedroomb_manual_override_until = states('input_datetime.bedroomb_manual_override_until') %}\n{% set manual_override_active = is_state('input_boolean.bedroomb_manual_override', 'on') and bedroomb_manual_override_until not in ['unknown', 'unavailable', 'none'] and as_timestamp(bedroomb_manual_override_until, 0) > as_timestamp(now()) %}\n{% if primary_battery > room_sensor_min_battery and primary_room is not none %}\n  {% set source = 'primary_room_sensor' %}\n  {% set effective = primary_room %}\n{% elif secondary_battery > room_sensor_min_battery and secondary_room is not none %}\n  {% set source = 'secondary_room_sensor' %}\n  {% set effective = secondary_room %}\n{% else %}\n  {% set source = 'climate_fallback' %}\n  {% set effective = ac_temp %}\n{% endif %}"
: "{% set source = 'room_sensor' if battery > room_sensor_min_battery and room is not none else 'climate_fallback' %}\n{% set effective = room if source == 'room_sensor' else ac_temp %}\n{% set livingr_manual_override_until = states('input_datetime.livingr_manual_override_until') %}\n{% set manual_override_active = is_state('input_boolean.livingr_manual_override', 'on') and livingr_manual_override_until not in ['unknown', 'unavailable', 'none'] and as_timestamp(livingr_manual_override_until, 0) > as_timestamp(now()) %}\n{% set allow_night_cooling = is_state('input_boolean.livingr_allow_night_cooling', 'on') %}"}
{% set day_summer_target = mild_summer_target if climate_mode == 'summer' and outside is not none and outside < mild_outside_threshold else hot_summer_target if climate_mode == 'summer' else none %}
{% set target = night_summer_target if night_sleep_window and climate_mode == 'summer' else day_summer_target if climate_mode == 'summer' else night_winter_target if night_sleep_window and climate_mode == 'winter' else winter_target if climate_mode == 'winter' else none %}
{% set active_cooling_start_delta = night_cooling_start_delta if night_sleep_window else cooling_start_delta %}
{% set active_winter_start_delta = night_winter_start_delta if night_sleep_window else winter_start_delta %}
{% set learned_overshoot = [0, [1, states('input_number.${prefix}_cooling_overshoot') | float(0.2)] | min] | max %}
{% set cooling_stop_room_temp = states('input_number.${prefix}_cooling_stop_room_temp') | float(0) %}
{% set error = effective - target if effective is not none and target is not none else none %}
{% set dynamic_setpoint = ([16, [31, ((ac_temp - error) * 2) | round(0) / 2] | min] | max) if ac_temp is not none and error is not none else none %}`;
}

function setupBlock(prefix, original) {
  const lines = String(original).split("\n");
  const tailIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("{%");
  });
  const tail = tailIndex === -1 ? "" : lines.slice(tailIndex).join("\n");
  return tail ? `${buildSetup(prefix)}\n${tail}` : buildSetup(prefix);
}

function templateWith(prefix, suffix) {
  return `${buildSetup(prefix)}\n${suffix}`;
}

function repairBehaviorTemplates(config, prefix) {
  const climate = prefix === "livingr" ? "climate.hol_2" : "climate.v357_spalniag_2";
  const isLiving = prefix === "livingr";
  const choose = config.action?.[0]?.choose || [];
  const byAlias = Object.fromEntries(choose.map((branch) => [branch.alias, branch]));

  config.condition = config.condition || [];
  const outsideCondition = { condition: "template", value_template: templateWith(prefix, "{{ outside is not none }}") };
  const manualCondition = { condition: "template", value_template: templateWith(prefix, "{{ not manual_override_active }}") };
  if (config.condition[2]) config.condition[2] = outsideCondition;
  else config.condition.push(outsideCondition);
  const manualIndex = config.condition.findIndex((condition) => String(condition.value_template || "").includes("manual_override_active"));
  if (manualIndex >= 0) config.condition[manualIndex] = manualCondition;
  else config.condition.push(manualCondition);

  if (byAlias["Night: air cleaning fan only at max speed"]?.conditions?.[0]) {
    byAlias["Night: air cleaning fan only at max speed"].conditions[0].value_template = templateWith(
      prefix,
      `{{ night_air_clean_window and (states('${climate}') != 'fan_only' or (state_attr('${climate}', 'fan_mode') or '') != '5') }}`,
    );
  }

  const nightOffAlias = isLiving
    ? "Night: sleep keeps climate off outside air-clean window"
    : "Night: keep climate off while inside the night comfort band";
  if (byAlias[nightOffAlias]?.conditions?.[0]) {
    byAlias[nightOffAlias].conditions[0].value_template = templateWith(
      prefix,
      `{{ night_sleep_window and not night_air_clean_window and states('${climate}') != 'off' and not (climate_mode == 'summer' and effective is not none and target is not none and effective >= target + active_cooling_start_delta) and not (climate_mode == 'winter' and effective is not none and target is not none and effective <= target - active_winter_start_delta) }}`,
    );
  }

  if (byAlias["Daytime no motion: raise fan while climate is already running"]?.conditions?.[0]) {
    byAlias["Daytime no motion: raise fan while climate is already running"].conditions[0].value_template = templateWith(
      prefix,
      `{{ not night_sleep_window and day_air_clean_window and is_state('binary_sensor.${isLiving ? "motion01" : "motion03"}', 'off') and states('${climate}') == 'fan_only' and (state_attr('${climate}', 'fan_mode') or '') not in ['2', '5'] }}`,
    );
  }

  if (byAlias["Daytime motion: restore fan 3 while climate is already running"]?.conditions?.[0]) {
    byAlias["Daytime motion: restore fan 3 while climate is already running"].conditions[0].value_template = templateWith(
      prefix,
      `{{ not night_sleep_window and day_air_clean_window and is_state('binary_sensor.${isLiving ? "motion01" : "motion03"}', 'on') and ((states('${climate}') == 'fan_only' and (state_attr('${climate}', 'fan_mode') or '') not in ['2', '3']) or (states('${climate}') == 'cool' and (state_attr('${climate}', 'fan_mode') or '') != (cooling_fan_mode | string))) }}`,
    );
    const coolFan = byAlias["Daytime motion: restore fan 3 while climate is already running"].sequence?.[0]?.choose?.[0]?.sequence?.[0]?.data;
    if (coolFan) coolFan.fan_mode = templateWith(prefix, "{{ cooling_fan_mode }}");
  }

  if (byAlias["Summer: cool when room is above target comfort band and outside mode is summer"]?.conditions?.[0]) {
    byAlias["Summer: cool when room is above target comfort band and outside mode is summer"].conditions[0].value_template = templateWith(
      prefix,
      isLiving
        ? "{{ not night_air_clean_window and climate_mode == 'summer' and (not night_sleep_window or allow_night_cooling) and effective is not none and target is not none and effective >= target + active_cooling_start_delta and dynamic_setpoint is not none }}"
        : "{{ not night_air_clean_window and climate_mode == 'summer' and effective is not none and target is not none and effective >= target + active_cooling_start_delta and dynamic_setpoint is not none }}",
    );
  }
  if (byAlias["Summer: cool when room is above target comfort band and outside mode is summer"]?.conditions?.[1]) {
    byAlias["Summer: cool when room is above target comfort band and outside mode is summer"].conditions[1].value_template = templateWith(
      prefix,
      `{{ states('${climate}') != 'cool' or (state_attr('${climate}', 'temperature') | float(0)) != (dynamic_setpoint | float) }}`,
    );
    const summerSeq = byAlias["Summer: cool when room is above target comfort band and outside mode is summer"].sequence || [];
    if (summerSeq[1]?.data) summerSeq[1].data.fan_mode = templateWith(prefix, "{{ cooling_fan_mode }}");
    if (summerSeq[2]?.data) summerSeq[2].data.temperature = templateWith(prefix, "{{ dynamic_setpoint }}");
  }

  if (byAlias["Summer: coil cool-down after target is reached or outside mode is no longer summer"]?.conditions?.[0]) {
    byAlias["Summer: coil cool-down after target is reached or outside mode is no longer summer"].conditions[0].value_template = templateWith(
      prefix,
      `{{ states('${climate}') == 'cool' and (climate_mode != 'summer' or (effective is not none and target is not none and effective <= target + learned_overshoot)) }}`,
    );
    const cooldownSeq = byAlias["Summer: coil cool-down after target is reached or outside mode is no longer summer"].sequence || [];
    if (cooldownSeq[0]?.data) cooldownSeq[0].data.value = templateWith(prefix, "{{ effective | round(1) if effective is not none else 0 }}");
    if (cooldownSeq[2]?.data) cooldownSeq[2].data.fan_mode = templateWith(prefix, "{{ cooling_fan_mode }}");
  }

  if (byAlias["Summer: turn off after coil cool-down"]?.conditions?.[0]) {
    byAlias["Summer: turn off after coil cool-down"].conditions[0].value_template = templateWith(
      prefix,
      `{{ not night_air_clean_window and states('${climate}') == 'fan_only' and (state_attr('${climate}', 'fan_mode') or '') == (cooling_fan_mode | string) and (as_timestamp(now()) - as_timestamp(states.${climate}.last_changed)) >= (coil_cooldown_minutes * 60) }}`,
    );
    const offSeq = byAlias["Summer: turn off after coil cool-down"].sequence || [];
    if (offSeq[0]?.data) {
      offSeq[0].data.value = templateWith(
        prefix,
        "{% set measured = [0, cooling_stop_room_temp - effective] | max if effective is not none and cooling_stop_room_temp > 0 else learned_overshoot %}\n{{ ([0, [1, (learned_overshoot * 0.7 + measured * 0.3)] | min] | max) | round(1) }}",
      );
    }
  }

  const winterHeatAlias = isLiving
    ? "Winter: heat when room is below 21.5C and outside mode is winter"
    : "Winter: heat when room is below target band and outside mode is winter";
  if (byAlias[winterHeatAlias]?.conditions?.[0]) {
    byAlias[winterHeatAlias].conditions[0].value_template = templateWith(
      prefix,
      `{{ not night_air_clean_window and climate_mode == 'winter' and effective is not none and target is not none and effective <= target - active_winter_start_delta and dynamic_setpoint is not none }}`,
    );
  }
  if (byAlias[winterHeatAlias]?.conditions?.[1]) {
    byAlias[winterHeatAlias].conditions[1].value_template = templateWith(
      prefix,
      `{{ states('${climate}') != 'heat' or (state_attr('${climate}', 'temperature') | float(0)) != (dynamic_setpoint | float) }}`,
    );
    const heatSeq = byAlias[winterHeatAlias].sequence || [];
    if (heatSeq[1]?.data) heatSeq[1].data.temperature = templateWith(prefix, "{{ dynamic_setpoint }}");
  }

  if (byAlias["Winter: turn off after target is reached or outside mode is no longer winter"]?.conditions?.[0]) {
    byAlias["Winter: turn off after target is reached or outside mode is no longer winter"].conditions[0].value_template = templateWith(
      prefix,
      `{{ states('${climate}') == 'heat' and (climate_mode != 'winter' or (effective is not none and target is not none and effective >= target)) }}`,
    );
  }

  return config;
}

function replaceSetupTemplates(config, prefix) {
  function walk(value) {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, walk(child)]));
    }
    if (typeof value !== "string" || !value.startsWith("{% set")) return value;
    return setupBlock(prefix, value);
  }
  const patched = repairBehaviorTemplates(walk(config), prefix);
  if (prefix === "livingr") {
    const choose = patched.action?.[0]?.choose || [];
    for (const branch of choose) {
      if (branch.alias === "Summer: cool when room is above target comfort band and outside mode is summer") {
        branch.conditions[0].value_template = templateWith(
          prefix,
          "{{ not night_air_clean_window and climate_mode == 'summer' and (not night_sleep_window or allow_night_cooling) and effective is not none and target is not none and effective >= target + active_cooling_start_delta and dynamic_setpoint is not none }}",
        );
      }
    }
  }
  return patched;
}

(async () => {
  const living = await rest("/api/config/automation/config/1770077000010");
  await rest("/api/config/automation/config/1770077000010", "POST", replaceSetupTemplates(living, "livingr"));
  const bed = await rest("/api/config/automation/config/1770077000021");
  await rest("/api/config/automation/config/1770077000021", "POST", replaceSetupTemplates(bed, "bedroomb"));
  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/turn_on", "POST", {
    entity_id: [
      "automation.test_aircon_livingr_room_sensor_comfort_band",
      "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    ],
  });
  console.log(JSON.stringify({
    updated: ["1770077000010", "1770077000021"],
    rearmed: [
      "automation.test_aircon_livingr_room_sensor_comfort_band",
      "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    ],
  }, null, 2));
})();
