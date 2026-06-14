const { connectWs, rest } = require("./ha_ws_util");

const rooms = {
  livingr: {
    viewPath: "living",
    title: "LivingR",
    climate: "climate.hol_2",
    automation: "automation.test_aircon_livingr_room_sensor_comfort_band",
    programRequest: "input_boolean.livingr_program_requested",
    power: "switch.hol_power",
    energy: "sensor.hol_energy_2",
    prefix: "livingr",
    sensorEntities: [
      "sensor.miaomiaoce_t2_1228_temperature_humidity_sensor",
      "sensor.miaomiaoce_t2_1228_battery_level",
    ],
    targets: {
      mild: "input_number.livingr_target_temperature",
      hot: "input_number.livingr_hot_summer_target",
      nightSummer: "input_number.livingr_night_summer_target",
      winter: "input_number.livingr_winter_target",
      nightWinter: "input_number.livingr_night_winter_target",
    },
    deltas: {
      dayCooling: "input_number.livingr_cooling_start_delta",
      nightCooling: "input_number.livingr_night_cooling_start_delta",
      dayWinter: "input_number.livingr_winter_start_delta",
      nightWinter: "input_number.livingr_night_winter_start_delta",
    },
    defaults: {
      nightSummer: 30,
      nightWinter: 19,
      nightCoolingDelta: 0.4,
      nightWinterDelta: 0.5,
    },
  },
  bedroomb: {
    viewPath: "bedb",
    title: "BedroomB",
    climate: "climate.v357_spalniag_2",
    automation: "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    programRequest: "input_boolean.bedroomb_program_requested",
    power: "switch.v357_spalniag_power",
    energy: "sensor.v357_spalniag_energy_2",
    prefix: "bedroomb",
    sensorEntities: [
      "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor",
      "sensor.miaomiaoce_t2_5249_battery_level",
      "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor",
      "sensor.miaomiaoce_t2_faea_battery_level",
      "sensor.v357_spalniag_room_temperature_2",
      "sensor.miaomiaoce_t2_1846_temperature_humidity_sensor",
      "sensor.miaomiaoce_t2_1846_battery_level",
    ],
    targets: {
      mild: "input_number.bedroomb_target_temperature",
      hot: "input_number.bedroomb_hot_summer_target",
      nightSummer: "input_number.bedroomb_night_summer_target",
      winter: "input_number.bedroomb_winter_target",
      nightWinter: "input_number.bedroomb_night_winter_target",
    },
    deltas: {
      dayCooling: "input_number.bedroomb_cooling_start_delta",
      nightCooling: "input_number.bedroomb_night_cooling_start_delta",
      dayWinter: "input_number.bedroomb_winter_start_delta",
      nightWinter: "input_number.bedroomb_night_winter_start_delta",
    },
    defaults: {
      nightSummer: 28,
      nightWinter: 19,
      nightCoolingDelta: 0.4,
      nightWinterDelta: 0.5,
    },
  },
};

function idFromEntity(entityId) {
  return entityId.replace(/^input_number\./, "");
}

function friendlyTargetNames(room) {
  return [
    [room.targets.mild, `${room.title} Mild Summer Day Target`],
    [room.targets.hot, `${room.title} Hot Summer Day Target`],
    [room.targets.nightSummer, `${room.title} Summer Night Target`],
    [room.targets.winter, `${room.title} Winter Day Target`],
    [room.targets.nightWinter, `${room.title} Winter Night Target`],
    [room.deltas.dayCooling, `${room.title} Day Cooling Start Delta`],
    [room.deltas.nightCooling, `${room.title} Night Cooling Start Delta`],
    [room.deltas.dayWinter, `${room.title} Day Winter Start Delta`],
    [room.deltas.nightWinter, `${room.title} Night Winter Start Delta`],
  ];
}

async function ensureInputNumbers(ws) {
  let id = 1;
  const list = await ws.request({ id: ++id, type: "input_number/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const byId = new Map(list.result.map((h) => [h.id, h]));
  const changes = [];
  for (const room of Object.values(rooms)) {
    const ensure = [
      [room.targets.nightSummer, `${room.title} Summer Night Target`, 18, 31, 0.1, room.defaults.nightSummer],
      [room.targets.nightWinter, `${room.title} Winter Night Target`, 16, 26, 0.1, room.defaults.nightWinter],
      [room.deltas.nightCooling, `${room.title} Night Cooling Start Delta`, 0.1, 2, 0.1, room.defaults.nightCoolingDelta],
      [room.deltas.nightWinter, `${room.title} Night Winter Start Delta`, 0.1, 3, 0.1, room.defaults.nightWinterDelta],
    ];
    for (const [entity, name, min, max, step, initial] of ensure) {
      const helperId = idFromEntity(entity);
      const payload = { id: ++id, name, min, max, step, initial, mode: "box", unit_of_measurement: "temperature" };
      if (byId.has(helperId)) {
        const res = await ws.request({ ...payload, type: "input_number/update", input_number_id: helperId });
        if (!res.success) throw new Error(JSON.stringify(res));
        changes.push(`updated ${entity}`);
      } else {
        const res = await ws.request({ ...payload, type: "input_number/create" });
        if (!res.success) throw new Error(JSON.stringify(res));
        changes.push(`created ${entity}`);
      }
    }
    for (const [entity, name] of friendlyTargetNames(room)) {
      const helperId = idFromEntity(entity);
      const existing = byId.get(helperId);
      if (!existing) continue;
      const res = await ws.request({
        id: ++id,
        type: "input_number/update",
        input_number_id: helperId,
        name,
        min: existing.min,
        max: existing.max,
        step: existing.step,
        initial: existing.initial,
        mode: existing.mode || "box",
        ...(existing.unit_of_measurement ? { unit_of_measurement: existing.unit_of_measurement } : {}),
      });
      if (!res.success) throw new Error(JSON.stringify(res));
    }
  }
  return changes;
}

function setupPatch(text) {
  if (!text.includes("night_summer_target") && text.includes("livingr_target_temperature")) {
    text = text.replace(
      "{% set winter_target = states('input_number.livingr_winter_target') | float(22) %}\n{% set cooling_start_delta = states('input_number.livingr_cooling_start_delta') | float(0.4) %}",
      "{% set winter_target = states('input_number.livingr_winter_target') | float(22) %}\n{% set night_summer_target = states('input_number.livingr_night_summer_target') | float(30) %}\n{% set night_winter_target = states('input_number.livingr_night_winter_target') | float(19) %}\n{% set night_cooling_start_delta = states('input_number.livingr_night_cooling_start_delta') | float(0.4) %}\n{% set night_winter_start_delta = states('input_number.livingr_night_winter_start_delta') | float(0.5) %}\n{% set cooling_start_delta = states('input_number.livingr_cooling_start_delta') | float(0.4) %}",
    );
    text = text.replace(
      "{% set target = mild_summer_target if climate_mode == 'summer' and outside is not none and outside < mild_outside_threshold else hot_summer_target if climate_mode == 'summer' else winter_target if climate_mode == 'winter' else none %}",
      "{% set day_summer_target = mild_summer_target if climate_mode == 'summer' and outside is not none and outside < mild_outside_threshold else hot_summer_target if climate_mode == 'summer' else none %}\n{% set target = night_summer_target if night_sleep_window and climate_mode == 'summer' else day_summer_target if climate_mode == 'summer' else night_winter_target if night_sleep_window and climate_mode == 'winter' else winter_target if climate_mode == 'winter' else none %}\n{% set active_cooling_start_delta = night_cooling_start_delta if night_sleep_window else cooling_start_delta %}\n{% set active_winter_start_delta = night_winter_start_delta if night_sleep_window else winter_start_delta %}",
    );
    text = text.replaceAll("target + cooling_start_delta", "target + active_cooling_start_delta");
    text = text.replaceAll("target - winter_start_delta", "target - active_winter_start_delta");
  }
  return text;
}

function patchAutomation(value) {
  if (Array.isArray(value)) return value.map(patchAutomation);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = patchAutomation(child);
    return out;
  }
  if (typeof value !== "string") return value;
  return setupPatch(value);
}

function activeScenarioMarkdown(room) {
  const p = room.prefix;
  const t = room.targets;
  return `### Active scenario

{% set outside_raw = states('sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor') | float(none) %}
{% set outside = outside_raw - (states('input_number.${p}_venti_in_offset') | float(2)) if outside_raw is not none else none %}
{% set summer_threshold = states('input_number.${p}_summer_outside_threshold') | float(15) %}
{% set winter_threshold = states('input_number.${p}_winter_outside_threshold') | float(8) %}
{% set mild_threshold = states('input_number.${p}_mild_outside_threshold') | float(28) %}
{% set ns = states('input_datetime.${p}_night_start').split(':') %}
{% set ds = states('input_datetime.${p}_day_start').split(':') %}
{% set now_m = now().hour * 60 + now().minute %}
{% set night_m = (ns[0] | int) * 60 + (ns[1] | int) %}
{% set day_m = (ds[0] | int) * 60 + (ds[1] | int) %}
{% set is_night = (now_m >= night_m and now_m < day_m) if night_m < day_m else (now_m >= night_m or now_m < day_m) %}
{% set season = 'winter' if outside is not none and outside <= winter_threshold else 'summer' if outside is not none and outside >= summer_threshold else 'neutral' %}
{% set scenario = 'Summer night' if season == 'summer' and is_night else 'Mild summer day' if season == 'summer' and outside < mild_threshold else 'Hot summer day' if season == 'summer' else 'Winter night' if season == 'winter' and is_night else 'Winter day' if season == 'winter' else 'Neutral' %}
{% set target = states('${t.nightSummer}') if scenario == 'Summer night' else states('${t.mild}') if scenario == 'Mild summer day' else states('${t.hot}') if scenario == 'Hot summer day' else states('${t.nightWinter}') if scenario == 'Winter night' else states('${t.winter}') if scenario == 'Winter day' else 'none' %}
<ha-alert alert-type="info">Active: <b>{{ scenario }}</b> · target <b>{{ target }}</b> · outside {{ outside if outside is not none else 'n/a' }}°C</ha-alert>`;
}

function scenarioTargetsCard(room) {
  const t = room.targets;
  return {
    type: "entities",
    title: "Scenario targets",
    entities: [
      { entity: t.mild, name: "Mild summer day" },
      { entity: t.hot, name: "Hot summer day" },
      { entity: t.nightSummer, name: "Summer night" },
      { entity: t.winter, name: "Winter day" },
      { entity: t.nightWinter, name: "Winter night" },
    ],
  };
}

function thresholdsCard(room) {
  return {
    type: "entities",
    title: "Scenario thresholds",
    entities: [
      { entity: room.deltas.dayCooling, name: "Day cooling delta" },
      { entity: room.deltas.nightCooling, name: "Night cooling delta" },
      { entity: room.deltas.dayWinter, name: "Day winter delta" },
      { entity: room.deltas.nightWinter, name: "Night winter delta" },
      { entity: `input_number.${room.prefix}_mild_outside_threshold`, name: "Mild/hot summer split" },
      { entity: `input_number.${room.prefix}_summer_outside_threshold`, name: "Summer starts outside" },
      { entity: `input_number.${room.prefix}_winter_outside_threshold`, name: "Winter starts outside" },
    ],
  };
}

function tuningCard(room) {
  return {
    type: "entities",
    title: "Tuning",
    entities: [
      { entity: `input_number.${room.prefix}_cooling_fan_mode`, name: "Cooling fan mode" },
      { entity: `input_number.${room.prefix}_coil_cooldown_minutes`, name: "Coil cooldown minutes" },
      { entity: `input_number.${room.prefix}_cooling_overshoot`, name: "Cooling overshoot" },
    ],
  };
}

function overshootInfo() {
  return {
    type: "markdown",
    title: "Cooling overshoot",
    content: "Cooling overshoot is the learned extra cooling that happens after the compressor stops and the coil is still cold. The program stops active cooling a little before the target, runs fan-only for the cooldown period, then updates this value from the measured drop.",
  };
}

function programLog(room) {
  return {
    type: "logbook",
    title: "Program log",
    hours_to_show: 24,
    entities: [room.automation, room.climate],
  };
}

function isDuplicate(card) {
  const title = card.title || "";
  if (["Primary", "Season", "Current program state"].includes(title)) return true;
  if (title === "Night") return true;
  if (title === "Scenario targets" || title === "Scenario thresholds" || title === "Tuning" || title === "Cooling overshoot" || title === "Program log") return true;
  if (card.type === "gauge" && String(card.entity || "").includes("_target_temperature")) return true;
  if (card.type === "markdown" && String(card.content || "").includes("Current program state")) return true;
  if (card.type === "markdown" && String(card.content || "").includes("control loop")) return true;
  return false;
}

function rebuildView(view, room) {
  const keep = (view.cards || []).filter((card) => !isDuplicate(card));
  const insertAt = Math.min(3, keep.length);
  keep.splice(
    insertAt,
    0,
    { type: "markdown", content: activeScenarioMarkdown(room) },
    scenarioTargetsCard(room),
    thresholdsCard(room),
    tuningCard(room),
    overshootInfo(),
  );
  keep.push(programLog(room));
  view.cards = keep;
}

(async () => {
  const ws = await connectWs();
  const helperChanges = await ensureInputNumbers(ws);

  for (const [key, room] of Object.entries(rooms)) {
    const id = key === "livingr" ? "1770077000010" : "1770077000021";
    const cfg = await rest(`/api/config/automation/config/${id}`);
    await rest(`/api/config/automation/config/${id}`, "POST", patchAutomation(cfg));
  }
  await rest("/api/services/automation/reload", "POST", {});

  let id = 5000;
  const res = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!res.success) throw new Error(JSON.stringify(res));
  const dash = res.result;
  for (const room of Object.values(rooms)) {
    const view = dash.views.find((v) => v.path === room.viewPath);
    if (!view) throw new Error(`Missing ${room.viewPath}`);
    rebuildView(view, room);
  }
  const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config: dash });
  if (!save.success) throw new Error(JSON.stringify(save));
  ws.close();
  console.log(JSON.stringify({ helperChanges, updated: true }, null, 2));
})();
