const { connectWs, rest } = require("./ha_ws_util");

const HELPER_ID = "livingr_allow_night_cooling";
const HELPER_ENTITY = `input_boolean.${HELPER_ID}`;
const DASHBOARD_PATH = "my-dash";
const VIEW_PATH = "living";
const AUTOMATION_ID = "1770077000010";

async function ensureHelper(ws) {
  let id = 100;
  const list = await ws.request({ id: ++id, type: "input_boolean/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === HELPER_ID);
  const payload = {
    id: ++id,
    name: "LivingR Allow Night Cooling",
    icon: "mdi:weather-night",
  };
  if (existing) {
    const res = await ws.request({ ...payload, type: "input_boolean/update", input_boolean_id: HELPER_ID });
    if (!res.success) throw new Error(JSON.stringify(res));
    return "updated";
  }
  const res = await ws.request({ ...payload, type: "input_boolean/create" });
  if (!res.success) throw new Error(JSON.stringify(res));
  await rest("/api/services/input_boolean/turn_off", "POST", { entity_id: HELPER_ENTITY });
  return "created";
}

function patchAutomation(config) {
  function walk(value) {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, walk(child)]));
    }
    if (typeof value !== "string") return value;
    let text = value;
    if (text.startsWith("{% set") && text.includes("manual_override_active") && !text.includes("allow_night_cooling")) {
      text = text.replace(
        "{% set manual_override_active = is_state('input_boolean.livingr_manual_override', 'on') and livingr_manual_override_until not in ['unknown', 'unavailable', 'none'] and as_timestamp(livingr_manual_override_until, 0) > as_timestamp(now()) %}",
        "{% set manual_override_active = is_state('input_boolean.livingr_manual_override', 'on') and livingr_manual_override_until not in ['unknown', 'unavailable', 'none'] and as_timestamp(livingr_manual_override_until, 0) > as_timestamp(now()) %}\n{% set allow_night_cooling = is_state('input_boolean.livingr_allow_night_cooling', 'on') %}",
      );
    }
    text = text.replace(
      "mode={{ climate_mode }}, manual_override={{ manual_override_active }}, manual_until={{ livingr_manual_override_until }}, night_sleep=",
      "mode={{ climate_mode }}, manual_override={{ manual_override_active }}, manual_until={{ livingr_manual_override_until }}, allow_night_cooling={{ allow_night_cooling }}, night_sleep=",
    );
    text = text.replace(
      "{{ not night_air_clean_window and climate_mode == 'summer' and effective is not none and target is not none and effective >= target + active_cooling_start_delta and dynamic_setpoint is not none }}",
      "{{ not night_air_clean_window and climate_mode == 'summer' and (not night_sleep_window or allow_night_cooling) and effective is not none and target is not none and effective >= target + active_cooling_start_delta and dynamic_setpoint is not none }}",
    );
    return text;
  }
  return walk(config);
}

function patchDashboard(config) {
  const view = (config.views || []).find((item) => item.path === VIEW_PATH);
  if (!view) throw new Error(`Missing Lovelace view ${VIEW_PATH}`);
  view.cards = view.cards || [];
  const nightEntities = [
    "input_number.livingr_summer_night_target",
    "input_number.livingr_night_cooling_start_delta",
    "input_number.livingr_winter_night_target",
    "input_number.livingr_night_winter_start_delta",
    HELPER_ENTITY,
  ];
  const nightCard = view.cards.find((card) => card.type === "entities" && card.title === "Night");
  if (nightCard) {
    const existing = new Set((nightCard.entities || []).map((item) => typeof item === "string" ? item : item.entity));
    for (const entity of nightEntities) {
      if (!existing.has(entity)) {
        nightCard.entities = nightCard.entities || [];
        nightCard.entities.push(entity);
      }
    }
    return "updated";
  }
  const scheduleIndex = view.cards.findIndex((card) => card.type === "entities" && card.title === "Schedule");
  const card = {
    type: "entities",
    title: "Night",
    entities: nightEntities,
  };
  if (scheduleIndex >= 0) view.cards.splice(scheduleIndex + 1, 0, card);
  else view.cards.push(card);
  return "created";
}

(async () => {
  const ws = await connectWs();
  const helper = await ensureHelper(ws);
  const dashResp = await ws.request({ id: 200, type: "lovelace/config", url_path: DASHBOARD_PATH });
  if (!dashResp.success) throw new Error(JSON.stringify(dashResp));
  const dashboard = dashResp.result;
  const nightCard = patchDashboard(dashboard);
  const save = await ws.request({ id: 201, type: "lovelace/config/save", url_path: DASHBOARD_PATH, config: dashboard });
  if (!save.success) throw new Error(JSON.stringify(save));
  ws.close();

  const automation = await rest(`/api/config/automation/config/${AUTOMATION_ID}`);
  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patchAutomation(automation));
  await rest("/api/services/automation/reload", "POST", {});

  const states = await rest("/api/states");
  const summary = Object.fromEntries(
    states
      .filter((item) => [HELPER_ENTITY, "automation.test_aircon_livingr_room_sensor_comfort_band"].includes(item.entity_id))
      .map((item) => [item.entity_id, item.state]),
  );

  console.log(JSON.stringify({ helper, nightCard, summary }, null, 2));
})();
