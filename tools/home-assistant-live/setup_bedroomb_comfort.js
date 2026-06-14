const { connectWs, rest } = require("./ha_ws_util");

const node = "/Users/krasi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node";

const setup = `{% set primary_room = states('sensor.miaomiaoce_t2_5249_temperature_humidity_sensor') | float(none) %}
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
{% set coil_cooldown_minutes = states('input_number.bedroomb_coil_cooldown_minutes') | float(7) %}
{% set cooling_fan_mode = states('input_number.bedroomb_cooling_fan_mode') | int(2) %}
{% set minutes_now = now().hour * 60 + now().minute %}
{% set night_sleep_window = minutes_now >= 30 and minutes_now < 510 %}
{% set night_air_clean_window = minutes_now >= 180 and minutes_now < 360 %}
{% set night_window = night_air_clean_window %}
{% set day_air_clean_window = now().hour >= 8 and now().hour <= 23 %}
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
  {% set room = primary_room %}
  {% set battery = primary_battery %}
{% elif secondary_battery > room_sensor_min_battery and secondary_room is not none %}
  {% set source = 'ceiling_room_sensor' %}
  {% set room = secondary_room %}
  {% set battery = secondary_battery %}
{% else %}
  {% set source = 'climate_fallback' %}
  {% set room = none %}
  {% set battery = primary_battery %}
{% endif %}
{% set effective = room if source in ['primary_room_sensor', 'ceiling_room_sensor'] else ac_temp %}
{% set day_summer_target = mild_summer_target if climate_mode == 'summer' and outside is not none and outside < mild_outside_threshold else hot_summer_target if climate_mode == 'summer' else none %}
{% set target = night_summer_target if night_sleep_window and climate_mode == 'summer' else day_summer_target if climate_mode == 'summer' else night_winter_target if night_sleep_window and climate_mode == 'winter' else winter_target if climate_mode == 'winter' else none %}
{% set active_cooling_start_delta = night_cooling_start_delta if night_sleep_window else cooling_start_delta %}
{% set active_winter_start_delta = night_winter_start_delta if night_sleep_window else winter_start_delta %}
{% set learned_overshoot = [0, [1, states('input_number.bedroomb_cooling_overshoot') | float(0.2)] | min] | max %}
{% set cooling_stop_room_temp = states('input_number.bedroomb_cooling_stop_room_temp') | float(0) %}
{% set error = effective - target if effective is not none and target is not none else none %}
{% set dynamic_setpoint = ([16, [31, ((ac_temp - error) * 2) | round(0) / 2] | min] | max) if ac_temp is not none and error is not none else none %}
}`;

const logSuffix = "mode={{ climate_mode }}, night_sleep={{ night_sleep_window }}, night_air_clean={{ night_air_clean_window }}, outside_source={{ outside_source }}, outside={{ outside }}, venti_raw={{ outside_venti_raw }}, venti_battery={{ outside_venti_battery }}%, weather={{ outside_weather }}, source={{ source }}, primary_room={{ primary_room }}, primary_battery={{ primary_battery }}%, ceiling_room={{ secondary_room }}, ceiling_battery={{ secondary_battery }}%, source_room={{ room }}, source_battery={{ battery }}%, ac_sensor={{ ac_temp }}, target={{ target }}, cooling_delta={{ active_cooling_start_delta }}, winter_delta={{ active_winter_start_delta }}, day_cooling_delta={{ cooling_start_delta }}, night_cooling_delta={{ night_cooling_start_delta }}, learned_overshoot={{ learned_overshoot }}, stop_room={{ cooling_stop_room_temp }}, fan={{ cooling_fan_mode }}, cooldown={{ coil_cooldown_minutes }}m, error={{ error | round(2) if error is not none else 'none' }}, setpoint={{ dynamic_setpoint }}";

const helperDefs = [
  ["BedroomB Target Temperature", "temperature", 18, 28, 0.1, 23.5, "box"],
  ["BedroomB Hot Summer Target", "temperature", 18, 30, 0.1, 23.8, "box"],
  ["BedroomB Cooling Start Delta", "temperature", 0.1, 2, 0.1, 0.4, "box"],
  ["BedroomB Night Summer Target", "temperature", 18, 30, 0.1, 28, "box"],
  ["BedroomB Night Winter Target", "temperature", 16, 26, 0.1, 19, "box"],
  ["BedroomB Night Cooling Start Delta", "temperature", 0.1, 2, 0.1, 0.4, "box"],
  ["BedroomB Night Winter Start Delta", "temperature", 0.1, 3, 0.1, 0.5, "box"],
  ["BedroomB Coil Cooldown Minutes", undefined, 1, 30, 1, 7, "box"],
  ["BedroomB Cooling Fan Mode", undefined, 1, 5, 1, 2, "slider"],
  ["BedroomB Mild Outside Threshold", "temperature", 20, 35, 0.5, 28, "box"],
  ["BedroomB Summer Outside Threshold", "temperature", 10, 25, 0.5, 15, "box"],
  ["BedroomB Winter Outside Threshold", "temperature", -10, 15, 0.5, 8, "box"],
  ["BedroomB Winter Target", "temperature", 16, 26, 0.1, 22, "box"],
  ["BedroomB Winter Start Delta", "temperature", 0.1, 3, 0.1, 0.5, "box"],
  ["BedroomB Venti In Offset", "temperature", -5, 5, 0.1, 2, "box"],
  ["BedroomB Room Sensor Min Battery", "%", 0, 100, 1, 10, "box"],
  ["BedroomB Outside Sensor Min Battery", "%", 0, 100, 1, 10, "box"],
  ["BedroomB Cooling Overshoot", "temperature", 0, 1, 0.1, 0.2, "box"],
  ["BedroomB Cooling Stop Room Temp", "temperature", 0, 35, 0.1, 0, "box"],
];

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function replaceDeep(value) {
  if (Array.isArray(value)) return value.map(replaceDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceDeep(v);
    return out;
  }
  if (typeof value !== "string") return value;

  let s = value;
  s = s.replaceAll("climate.hol_2", "climate.v357_spalniag_2");
  s = s.replaceAll("binary_sensor.motion01", "binary_sensor.motion03");
  s = s.replaceAll("sensor.miaomiaoce_t2_1228_temperature_humidity_sensor", "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor");
  s = s.replaceAll("sensor.miaomiaoce_t2_1228_battery_level", "sensor.miaomiaoce_t2_5249_battery_level");
  s = s.replaceAll("input_number.livingr_", "input_number.bedroomb_");
  s = s.replaceAll("livingr_", "bedroomb_");
  s = s.replaceAll("[TEST] LivingR climate comfort band", "[TEST] BedroomB climate comfort band");
  s = s.replaceAll("LivingR", "BedroomB");
  s = s.replaceAll("Living tv 1", "BdrmB 11");
  s = s.replaceAll("livingr", "bedroomb");
  s = s.replaceAll(
    "night_sleep_window and not night_air_clean_window and states('climate.v357_spalniag_2') != 'off'",
    "night_sleep_window and not night_air_clean_window and states('climate.v357_spalniag_2') != 'off' and not (climate_mode == 'summer' and effective is not none and target is not none and effective > target + active_cooling_start_delta) and not (climate_mode == 'winter' and effective is not none and target is not none and effective < target - active_winter_start_delta)",
  );
  s = s.replaceAll(
    "not night_sleep_window and climate_mode == 'summer' and effective is not none and target is not none and effective > target + cooling_start_delta",
    "not night_air_clean_window and climate_mode == 'summer' and effective is not none and target is not none and effective > target + active_cooling_start_delta",
  );
  s = s.replaceAll(
    "not night_sleep_window and climate_mode == 'winter' and effective is not none and target is not none and effective < target - winter_start_delta",
    "not night_air_clean_window and climate_mode == 'winter' and effective is not none and target is not none and effective < target - active_winter_start_delta",
  );
  s = s.replaceAll(
    "Night: sleep keeps climate off outside air-clean window",
    "Night: keep climate off while inside the night comfort band",
  );
  s = s.replaceAll(
    "Night sleep: climate off outside 03:00-06:00 air-clean window",
    "Night comfort band: climate off until room leaves the configured night band",
  );
  return s;
}

function patchTemplates(config) {
  function patchString(value) {
    if (typeof value !== "string") return value;
    if (!value.includes("{% set") && !value.includes("{{")) return value;
    if (value.startsWith("{% set")) {
      return value.replace(
        /^\{% set[\s\S]*?\{% set day_air_clean_window = now\(\)\.hour >= 8 and now\(\)\.hour <= 23 %\}/,
        setup,
      );
    }
    return value;
  }
  function walk(value) {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = k === "value_template" || k === "temperature" || k === "fan_mode" || k === "value" || k === "message" ? patchString(v) : walk(v);
      return out;
    }
    return patchString(value);
  }
  return walk(config);
}

function findCards(cards, predicate) {
  const results = [];
  for (const card of cards || []) {
    if (predicate(card)) results.push(card);
    if (card.cards) results.push(...findCards(card.cards, predicate));
  }
  return results;
}

function replaceDashboard(value) {
  if (Array.isArray(value)) return value.map(replaceDashboard);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceDashboard(v);
    return out;
  }
  if (typeof value !== "string") return value;
  return value
    .replaceAll("livingr-tuning", "bedroomb-tuning")
    .replaceAll("LivingR Tune", "BedroomB Tune")
    .replaceAll("LivingR", "BedroomB")
    .replaceAll("livingr", "bedroomb")
    .replaceAll("climate.hol_2", "climate.v357_spalniag_2")
    .replaceAll("sensor.hol_energy_2", "sensor.v357_spalniag_energy_2")
    .replaceAll("switch.hol_power", "switch.v357_spalniag_power")
    .replaceAll("sensor.miaomiaoce_t2_1228_temperature_humidity_sensor", "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor")
    .replaceAll("sensor.miaomiaoce_t2_1228_battery_level", "sensor.miaomiaoce_t2_5249_battery_level")
    .replaceAll("binary_sensor.motion01", "binary_sensor.motion03")
    .replaceAll("Hol Energy", "v357 SpalniaG Energy")
    .replaceAll("Hol Power", "v357 SpalniaG Power");
}

(async () => {
  const ws = await connectWs();
  let id = 1;

  const existingHelpers = await ws.request({ id: ++id, type: "input_number/list" });
  if (!existingHelpers.success) throw new Error(JSON.stringify(existingHelpers));
  const helperIds = new Set(existingHelpers.result.map((h) => h.id || h.entity_id?.replace("input_number.", "")));
  const createdHelpers = [];

  for (const [name, unit, min, max, step, initial, mode] of helperDefs) {
    const helperId = slug(name);
    if (helperIds.has(helperId)) continue;
    const payload = { id: ++id, type: "input_number/create", name, min, max, step, initial, mode };
    if (unit) payload.unit_of_measurement = unit;
    const res = await ws.request(payload);
    if (!res.success) throw new Error(`create ${helperId}: ${JSON.stringify(res)}`);
    createdHelpers.push(`input_number.${helperId}`);
  }

  const living = await rest("/api/config/automation/config/1770077000010");
  let bedroom = replaceDeep(living);
  bedroom = patchTemplates(bedroom);
  bedroom.id = "1770077000021";
  bedroom.alias = "[TEST] AirCon - BedroomB - room sensor comfort band";
  bedroom.description = "Test automation for BedroomB climate.v357_spalniag_2. Uses BdrmB 11 as the primary room temperature sensor while its battery is above the configurable threshold; falls back to BedroomB ceil 2 if healthy, then to climate current_temperature. Based on the LivingR comfort-band algorithm, with BedroomB-specific targets and the active MELCloud-with-ERV entity.";

  const triggers = bedroom.trigger;
  const roomTempIdx = triggers.findIndex((t) => t.entity_id === "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor");
  if (roomTempIdx !== -1) triggers[roomTempIdx].id = "primary_room_temperature_stable_change";
  const roomBatteryIdx = triggers.findIndex((t) => t.entity_id === "sensor.miaomiaoce_t2_5249_battery_level");
  if (roomBatteryIdx !== -1) triggers[roomBatteryIdx].id = "primary_room_sensor_battery_changed";
  triggers.splice(roomBatteryIdx + 1, 0,
    { platform: "state", entity_id: "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor", for: { minutes: 3 }, id: "ceiling_room_temperature_stable_change" },
    { platform: "state", entity_id: "sensor.miaomiaoce_t2_faea_battery_level", id: "ceiling_room_sensor_battery_changed" },
  );

  const savedAutomation = await rest("/api/config/automation/config/1770077000021", "POST", bedroom);
  await rest("/api/services/automation/reload", "POST", {});

  await rest("/api/services/automation/turn_off", "POST", {
    entity_id: [
      "automation.v2_aircon_morning_bedroomb_summer",
      "automation.v2_aircon_night_bedroomb_summer",
      "automation.v2_aircon_morning_bedroomb_winter",
      "automation.v2_aircon_night_bedroomb_winter",
    ],
    stop_actions: false,
  });
  await rest("/api/services/automation/turn_on", "POST", {
    entity_id: "automation.test_aircon_bedroomb_room_sensor_comfort_band",
  });

  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!lovelace.success) throw new Error(JSON.stringify(lovelace));
  const config = lovelace.result;
  const existingIdx = config.views.findIndex((v) => v.path === "bedroomb-tuning" || v.title === "BedroomB Tune");
  const livingView = config.views.find((v) => v.path === "livingr-tuning" || v.title === "LivingR Tune");
  if (!livingView) throw new Error("LivingR Tune view not found");
  const bedroomView = replaceDashboard(JSON.parse(JSON.stringify(livingView)));
  bedroomView.title = "BedroomB Tune";
  bedroomView.path = "bedroomb-tuning";
  bedroomView.icon = "mdi:bed-king";

  const mdCards = findCards(bedroomView.cards, (card) => card.type === "markdown" && String(card.content || "").includes("baseline + last 7 days"));
  for (const card of mdCards) {
    card.title = "BedroomB AC electricity - last 7 days";
    card.content = "### BedroomB AC electricity\n\nUses `sensor.v357_spalniag_energy_2`. Baseline rows are not pinned yet for BedroomB; the card is ready for the same comparison format once we pick baseline days.";
  }

  if (!findCards(bedroomView.cards, (card) => card.title === "Night comfort").length) {
    bedroomView.cards.splice(1, 0, {
      type: "entities",
      title: "Night comfort",
      entities: [
        "input_number.bedroomb_night_summer_target",
        "input_number.bedroomb_night_cooling_start_delta",
        "input_number.bedroomb_night_winter_target",
        "input_number.bedroomb_night_winter_start_delta",
      ],
    });
  }

  if (existingIdx === -1) config.views.push(bedroomView);
  else config.views[existingIdx] = bedroomView;

  for (const view of config.views) {
    if (!["Default", "AirCon", "BedroomB Tune", "LivingR Tune"].includes(view.title)) continue;
    const buttons = findCards(view.cards, (card) => card.type === "button" && (card.name === "LivingR Tune" || card.name === "BedroomB Tune"));
    if (!buttons.some((card) => card.name === "BedroomB Tune")) {
      view.cards.unshift({
        type: "button",
        name: "BedroomB Tune",
        icon: "mdi:bed-king",
        tap_action: { action: "navigate", navigation_path: "/my-dash/bedroomb-tuning" },
      });
    }
  }

  const savedLovelace = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config });
  if (!savedLovelace.success) throw new Error(JSON.stringify(savedLovelace));

  ws.close();

  const states = await rest("/api/states");
  const interesting = [
    "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    "automation.v2_aircon_morning_bedroomb_summer",
    "automation.v2_aircon_night_bedroomb_summer",
    "climate.v357_spalniag_2",
    "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor",
    "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor",
    "input_number.bedroomb_target_temperature",
    "sensor.v357_spalniag_energy_2",
  ];
  const stateMap = Object.fromEntries(states.filter((s) => interesting.includes(s.entity_id)).map((s) => [s.entity_id, {
    state: s.state,
    friendly_name: s.attributes?.friendly_name,
    temperature: s.attributes?.temperature,
    current_temperature: s.attributes?.current_temperature,
    fan_mode: s.attributes?.fan_mode,
  }]));

  console.log(JSON.stringify({
    createdHelpers,
    savedAutomation: savedAutomation?.id || "1770077000021",
    dashboardView: "/my-dash/bedroomb-tuning",
    states: stateMap,
  }, null, 2));
})();
