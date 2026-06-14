const { connectWs, rest } = require("./ha_ws_util");

const rooms = {
  livingr: {
    title: "LivingR",
    viewPath: "living",
    climate: "climate.hol_2",
    programRequest: "input_boolean.livingr_program_requested",
    comfortAutomation: "automation.test_aircon_livingr_room_sensor_comfort_band",
    comfortId: "1770077000010",
    overrideId: "1770077000041",
    overrideAlias: "[TEST] AirCon - LivingR - manual override",
    logName: "[TEST] LivingR manual override",
    setupAnchor: "{% set day_summer_target = mild_summer_target",
    setupInsert: "{% set livingr_manual_override_until = states('input_datetime.livingr_manual_override_until') %}\n{% set manual_override_active = is_state('input_boolean.livingr_manual_override_active', 'on') and livingr_manual_override_until not in ['unknown', 'unavailable', 'none'] and as_timestamp(livingr_manual_override_until, 0) > as_timestamp(now()) %}\n",
    suffixFind: "mode={{ climate_mode }}, night_sleep=",
    suffixReplace: "mode={{ climate_mode }}, manual_override={{ manual_override_active }}, manual_until={{ livingr_manual_override_until }}, night_sleep=",
    defaults: { temp: 24, fan: "2", swing: "5_down", hvac: "cool" },
  },
  bedroomb: {
    title: "BedroomB",
    viewPath: "bedb",
    climate: "climate.v357_spalniag_2",
    programRequest: "input_boolean.bedroomb_program_requested",
    comfortAutomation: "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    comfortId: "1770077000021",
    overrideId: "1770077000042",
    overrideAlias: "[TEST] AirCon - BedroomB - manual override",
    logName: "[TEST] BedroomB manual override",
    setupAnchor: "{% if primary_battery > room_sensor_min_battery",
    setupInsert: "{% set bedroomb_manual_override_until = states('input_datetime.bedroomb_manual_override_until') %}\n{% set manual_override_active = is_state('input_boolean.bedroomb_manual_override_active', 'on') and bedroomb_manual_override_until not in ['unknown', 'unavailable', 'none'] and as_timestamp(bedroomb_manual_override_until, 0) > as_timestamp(now()) %}\n",
    suffixFind: "mode={{ climate_mode }}, night_sleep=",
    suffixReplace: "mode={{ climate_mode }}, manual_override={{ manual_override_active }}, manual_until={{ bedroomb_manual_override_until }}, night_sleep=",
    defaults: { temp: 24, fan: "2", swing: "4", hvac: "cool" },
  },
};

const hvacModes = ["off", "heat", "dry", "cool", "fan_only", "heat_cool"];
const fanModes = ["auto", "1", "2", "3", "4", "5"];
const swingModes = ["auto", "1_up", "2", "3", "4", "5_down", "swing"];

function id(entity) {
  return entity.replace(/^[^.]+\./, "");
}

async function ensureInputBoolean(ws, entity, name) {
  const list = await ws.request({ id: ++ensureInputBoolean.seq, type: "input_boolean/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const helperId = id(entity);
  const existing = list.result.find((item) => item.id === helperId);
  const payload = { id: ++ensureInputBoolean.seq, name, icon: "mdi:hand-back-right" };
  const res = existing
    ? await ws.request({ ...payload, type: "input_boolean/update", input_boolean_id: helperId })
    : await ws.request({ ...payload, type: "input_boolean/create", id: ++ensureInputBoolean.seq, name, icon: "mdi:hand-back-right" });
  if (!res.success) throw new Error(JSON.stringify(res));
}
ensureInputBoolean.seq = 100;

async function ensureInputNumber(ws, entity, name, min, max, step, initial, unit = null) {
  const list = await ws.request({ id: ++ensureInputBoolean.seq, type: "input_number/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const helperId = id(entity);
  const existing = list.result.find((item) => item.id === helperId);
  const payload = { id: ++ensureInputBoolean.seq, name, min, max, step, initial, mode: "box", ...(unit ? { unit_of_measurement: unit } : {}) };
  const res = existing
    ? await ws.request({ ...payload, type: "input_number/update", input_number_id: helperId })
    : await ws.request({ ...payload, type: "input_number/create" });
  if (!res.success) throw new Error(JSON.stringify(res));
}

async function ensureInputSelect(ws, entity, name, options, initial, icon) {
  const list = await ws.request({ id: ++ensureInputBoolean.seq, type: "input_select/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const helperId = id(entity);
  const existing = list.result.find((item) => item.id === helperId);
  const payload = { id: ++ensureInputBoolean.seq, name, options, initial, icon };
  const res = existing
    ? await ws.request({ ...payload, type: "input_select/update", input_select_id: helperId })
    : await ws.request({ ...payload, type: "input_select/create" });
  if (!res.success) throw new Error(JSON.stringify(res));
}

async function ensureInputDatetime(ws, entity, name) {
  const list = await ws.request({ id: ++ensureInputBoolean.seq, type: "input_datetime/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const helperId = id(entity);
  const existing = list.result.find((item) => item.id === helperId);
  const payload = { id: ++ensureInputBoolean.seq, name, has_date: true, has_time: true, icon: "mdi:timer-sand" };
  const res = existing
    ? await ws.request({ ...payload, type: "input_datetime/update", input_datetime_id: helperId })
    : await ws.request({ ...payload, type: "input_datetime/create" });
  if (!res.success) throw new Error(JSON.stringify(res));
}

async function ensureHelpers(ws) {
  for (const [prefix, room] of Object.entries(rooms)) {
    await ensureInputBoolean(ws, `input_boolean.${prefix}_manual_override_active`, `${room.title} Manual Override`);
    await ensureInputNumber(ws, `input_number.${prefix}_manual_override_duration_minutes`, `${room.title} Override Duration`, 5, 480, 5, 60, "min");
    await ensureInputNumber(ws, `input_number.${prefix}_manual_override_target_temperature`, `${room.title} Manual Target Temperature`, 16, 31, 0.5, room.defaults.temp, "°C");
    await ensureInputSelect(ws, `input_select.${prefix}_manual_override_hvac_mode`, `${room.title} Manual HVAC Mode`, hvacModes, room.defaults.hvac, "mdi:air-conditioner");
    await ensureInputSelect(ws, `input_select.${prefix}_manual_override_fan_mode`, `${room.title} Manual Fan Mode`, fanModes, room.defaults.fan, "mdi:fan");
    await ensureInputSelect(ws, `input_select.${prefix}_manual_override_swing_mode`, `${room.title} Manual Swing Mode`, swingModes, room.defaults.swing, "mdi:swap-vertical");
    await ensureInputDatetime(ws, `input_datetime.${prefix}_manual_override_until`, `${room.title} Manual Override Until`);
  }
}

function patchComfortConfig(config, prefix, room) {
  const patchValue = (value) => {
    if (Array.isArray(value)) return value.map(patchValue);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, patchValue(child)]));
    if (typeof value !== "string") return value;
    let text = value;
    if (!text.includes("manual_override_active") && text.includes(room.setupAnchor)) {
      text = text.replace(room.setupAnchor, `${room.setupInsert}${room.setupAnchor}`);
    }
    if (!text.includes("manual_override={{ manual_override_active }}") && text.includes(room.suffixFind)) {
      text = text.replace(room.suffixFind, room.suffixReplace);
    }
    return text;
  };
  const out = patchValue(config);
  out.condition = out.condition || [];
  if (!out.condition.some((item) => JSON.stringify(item).includes("manual_override_active"))) {
    const outsideCondition = out.condition.find((item) => String(item.value_template || "").includes("{{ outside is not none }}"));
    const value_template = outsideCondition
      ? String(outsideCondition.value_template).replace("{{ outside is not none }}", "{{ not manual_override_active }}")
      : "{{ true }}";
    out.condition.push({ condition: "template", value_template });
  }
  return out;
}

function overrideAutomation(prefix, room) {
  const active = `input_boolean.${prefix}_manual_override_active`;
  const duration = `input_number.${prefix}_manual_override_duration_minutes`;
  const target = `input_number.${prefix}_manual_override_target_temperature`;
  const mode = `input_select.${prefix}_manual_override_hvac_mode`;
  const fan = `input_select.${prefix}_manual_override_fan_mode`;
  const swing = `input_select.${prefix}_manual_override_swing_mode`;
  const until = `input_datetime.${prefix}_manual_override_until`;
  return {
    alias: room.overrideAlias,
    description: `Applies temporary manual climate settings for ${room.title}. While ${active} is on and ${until} is in the future, the comfort-band automation stands down.`,
    mode: "restart",
    trigger: [
      { platform: "state", entity_id: active, to: "on", id: "override_started" },
      { platform: "state", entity_id: active, to: "off", id: "override_cancelled" },
      { platform: "state", entity_id: duration, id: "override_duration_changed" },
      { platform: "state", entity_id: [target, mode, fan, swing], id: "override_control_changed" },
      { platform: "time_pattern", minutes: "/1", id: "override_expiry_check" },
    ],
    condition: [{ condition: "template", value_template: `{{ states('${room.climate}') not in ['unknown', 'unavailable'] }}` }],
    action: [
      {
        choose: [
          {
            alias: "Expire manual override",
            conditions: [{ condition: "template", value_template: `{{ trigger.id == 'override_expiry_check' and is_state('${active}', 'on') and states('${until}') not in ['unknown', 'unavailable', 'none'] and as_timestamp(states('${until}'), 0) <= as_timestamp(now()) }}` }],
            sequence: [
              { service: "input_boolean.turn_off", target: { entity_id: active } },
              { service: "logbook.log", data: { name: room.logName, message: "Manual override expired; comfort program may resume", entity_id: room.climate } },
              { choose: [{ conditions: [{ condition: "state", entity_id: room.programRequest, state: "on" }], sequence: [{ service: "automation.trigger", target: { entity_id: room.comfortAutomation }, data: { skip_condition: false } }] }] },
            ],
          },
          {
            alias: "Manual override cancelled by user",
            conditions: [{ condition: "template", value_template: "{{ trigger.id == 'override_cancelled' }}" }],
            sequence: [
              { service: "logbook.log", data: { name: room.logName, message: "Manual override cancelled; comfort program may resume", entity_id: room.climate } },
              { choose: [{ conditions: [{ condition: "state", entity_id: room.programRequest, state: "on" }], sequence: [{ service: "automation.trigger", target: { entity_id: room.comfortAutomation }, data: { skip_condition: false } }] }] },
            ],
          },
          {
            alias: "Apply manual override controls",
            conditions: [{ condition: "template", value_template: `{{ is_state('${active}', 'on') and trigger.id in ['override_started', 'override_duration_changed', 'override_control_changed'] }}` }],
            sequence: [
              {
                choose: [{
                  conditions: [{ condition: "template", value_template: "{{ trigger.id in ['override_started', 'override_duration_changed'] }}" }],
                  sequence: [{ service: "input_datetime.set_datetime", target: { entity_id: until }, data: { datetime: `{{ (now() + timedelta(minutes=(states('${duration}') | int(60)))).strftime('%Y-%m-%d %H:%M:%S') }}` } }],
                }],
              },
              { service: "climate.set_hvac_mode", target: { entity_id: room.climate }, data: { hvac_mode: `{{ states('${mode}') }}` } },
              {
                choose: [{
                  conditions: [{ condition: "template", value_template: `{{ states('${mode}') != 'off' }}` }],
                  sequence: [
                    { service: "climate.set_temperature", target: { entity_id: room.climate }, data: { temperature: `{{ states('${target}') | float(24) }}` } },
                    { service: "climate.set_fan_mode", target: { entity_id: room.climate }, data: { fan_mode: `{{ states('${fan}') }}` } },
                    { service: "climate.set_swing_mode", target: { entity_id: room.climate }, data: { swing_mode: `{{ states('${swing}') }}` } },
                  ],
                }],
              },
              { service: "logbook.log", data: { name: room.logName, message: `Applied manual override: mode={{ states('${mode}') }}, target={{ states('${target}') }}, fan={{ states('${fan}') }}, swing={{ states('${swing}') }}, until={{ states('${until}') }}`, entity_id: room.climate } },
            ],
          },
        ],
      },
    ],
  };
}

function manualOverrideCard(prefix, room) {
  return {
    type: "entities",
    title: "Manual override",
    show_header_toggle: false,
    entities: [
      { entity: `input_boolean.${prefix}_manual_override_active`, name: "Manual override" },
      { entity: `input_number.${prefix}_manual_override_duration_minutes`, name: "Duration" },
      { entity: `input_datetime.${prefix}_manual_override_until`, name: "Active until" },
      { entity: `input_select.${prefix}_manual_override_hvac_mode`, name: "Mode" },
      { entity: `input_number.${prefix}_manual_override_target_temperature`, name: "Target temp" },
      { entity: `input_select.${prefix}_manual_override_fan_mode`, name: "Fan" },
      { entity: `input_select.${prefix}_manual_override_swing_mode`, name: "Vane" },
    ],
  };
}

function manualStatus(prefix) {
  return {
    type: "markdown",
    content: `### Manual override status

{% set active = is_state('input_boolean.${prefix}_manual_override_active', 'on') %}
{% set until = states('input_datetime.${prefix}_manual_override_until') %}
{% set running = active and until not in ['unknown', 'unavailable', 'none'] and as_timestamp(until, 0) > as_timestamp(now()) %}
<ha-alert alert-type="{{ 'warning' if running else 'success' }}">{{ 'Manual override active until ' ~ until if running else 'Comfort program controls this room' }}</ha-alert>`,
  };
}

async function patchDashboard(ws) {
  let id = 9000;
  const res = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!res.success) throw new Error(JSON.stringify(res));
  const dash = res.result;
  for (const [prefix, room] of Object.entries(rooms)) {
    const view = dash.views.find((item) => item.path === room.viewPath);
    if (!view) throw new Error(`Missing view ${room.viewPath}`);
    const cards = (view.cards || []).filter((card) => card.title !== "Manual override" && !String(card.content || "").includes("Manual override status"));
    const scenarioIndex = cards.findIndex((card) => card.title === "Scenario targets");
    const insertAt = scenarioIndex >= 0 ? scenarioIndex : Math.min(3, cards.length);
    cards.splice(insertAt, 0, manualStatus(prefix), manualOverrideCard(prefix, room));
    view.cards = cards;
  }
  const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config: dash });
  if (!save.success) throw new Error(JSON.stringify(save));
}

(async () => {
  const ws = await connectWs();
  await ensureHelpers(ws);
  for (const [prefix, room] of Object.entries(rooms)) {
    const comfort = await rest(`/api/config/automation/config/${room.comfortId}`);
    await rest(`/api/config/automation/config/${room.comfortId}`, "POST", patchComfortConfig(comfort, prefix, room));
    await rest(`/api/config/automation/config/${room.overrideId}`, "POST", overrideAutomation(prefix, room));
  }
  await rest("/api/services/automation/reload", "POST", {});
  await patchDashboard(ws);
  ws.close();
  console.log(JSON.stringify({ updated: true }, null, 2));
})();
