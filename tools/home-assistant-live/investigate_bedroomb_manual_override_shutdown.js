const { rest } = require("./ha_ws_util");

const HOURS = 4;
const ENTITIES = [
  "climate.v357_spalniag_2",
  "switch.v357_spalniag_power",
  "automation.test_aircon_bedroomb_room_sensor_comfort_band",
  "automation.test_aircon_bedroomb_manual_override",
  "input_boolean.bedroomb_manual_override",
  "input_boolean.bedroomb_manual_override_active",
  "input_boolean.bedroomb_program_requested",
  "input_number.bedroomb_override_duration",
  "input_number.bedroomb_manual_target_temperature",
  "input_select.bedroomb_manual_hvac_mode",
  "input_select.bedroomb_manual_fan_mode",
  "input_select.bedroomb_manual_swing_mode",
  "input_number.bedroomb_manual_override_duration_minutes",
  "input_number.bedroomb_manual_override_target_temperature",
  "input_select.bedroomb_manual_override_hvac_mode",
  "input_select.bedroomb_manual_override_fan_mode",
  "input_select.bedroomb_manual_override_swing_mode",
  "input_datetime.bedroomb_manual_override_until",
  "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor",
  "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor",
];

function iso(date) {
  return date.toISOString();
}

function interestingState(state) {
  if (!state) return null;
  return {
    state: state.state,
    last_changed: state.last_changed,
    last_updated: state.last_updated,
    context: state.context,
    attributes: {
      current_temperature: state.attributes?.current_temperature,
      temperature: state.attributes?.temperature,
      fan_mode: state.attributes?.fan_mode,
      hvac_modes: state.attributes?.hvac_modes,
      friendly_name: state.attributes?.friendly_name,
      last_triggered: state.attributes?.last_triggered,
      current: state.attributes?.current,
      mode: state.attributes?.mode,
    },
  };
}

function flattenHistory(history) {
  return history
    .flatMap((series) => series.map((state) => ({
      entity_id: state.entity_id,
      state: state.state,
      last_changed: state.last_changed,
      last_updated: state.last_updated,
      context: state.context,
      current_temperature: state.attributes?.current_temperature,
      temperature: state.attributes?.temperature,
      fan_mode: state.attributes?.fan_mode,
      last_triggered: state.attributes?.last_triggered,
    })))
    .sort((a, b) => a.last_changed.localeCompare(b.last_changed));
}

function summarizeAutomation(config) {
  const text = JSON.stringify(config);
  return {
    alias: config.alias,
    id: config.id,
    mode: config.mode,
    trigger_count: config.trigger?.length || 0,
    action_branches: config.action?.[0]?.choose?.map((branch) => branch.alias) || [],
    refs: {
      old_manual_boolean: text.includes("input_boolean.bedroomb_manual_override"),
      active_manual_boolean: text.includes("input_boolean.bedroomb_manual_override_active"),
      old_manual_target: text.includes("input_number.bedroomb_manual_target_temperature"),
      active_manual_target: text.includes("input_number.bedroomb_manual_override_target_temperature"),
      comfort_stands_down: text.includes("not manual_override_active"),
      comfort_uses_old_boolean: text.includes("is_state('input_boolean.bedroomb_manual_override', 'on')"),
      comfort_uses_active_boolean: text.includes("is_state('input_boolean.bedroomb_manual_override_active', 'on')"),
    },
  };
}

async function maybeRest(path) {
  try {
    return await rest(path);
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

(async () => {
  const now = new Date();
  const start = new Date(now.getTime() - HOURS * 60 * 60 * 1000);
  const states = await rest("/api/states");
  const byEntity = Object.fromEntries(states.map((state) => [state.entity_id, state]));

  const snapshot = Object.fromEntries(
    ENTITIES.map((entityId) => [entityId, interestingState(byEntity[entityId])]),
  );

  const history = await rest(
    `/api/history/period/${iso(start)}?end_time=${encodeURIComponent(iso(now))}&filter_entity_id=${encodeURIComponent(ENTITIES.join(","))}&minimal_response=false`,
  );

  const logbookEntities = [
    "climate.v357_spalniag_2",
    "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    "automation.test_aircon_bedroomb_manual_override",
    "input_boolean.bedroomb_manual_override",
    "input_boolean.bedroomb_manual_override_active",
  ];
  const logbook = {};
  for (const entityId of logbookEntities) {
    logbook[entityId] = await maybeRest(
      `/api/logbook/${iso(start)}?end_time=${encodeURIComponent(iso(now))}&entity=${encodeURIComponent(entityId)}`,
    );
  }

  const comfortConfig = await rest("/api/config/automation/config/1770077000021");
  const manualConfig = await rest("/api/config/automation/config/1770077000042");

  console.log(JSON.stringify({
    checked_at: iso(now),
    period_start: iso(start),
    snapshot,
    automation_configs: {
      comfort: summarizeAutomation(comfortConfig),
      manual_override: summarizeAutomation(manualConfig),
    },
    history: flattenHistory(history),
    logbook,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
