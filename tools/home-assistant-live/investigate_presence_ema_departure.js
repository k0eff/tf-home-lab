const { rest } = require("./ha_ws_util");

const ENTITIES = [
  "input_boolean.presence_ema_yosifova",
  "input_boolean.presence_krasimir_koev",
  "input_boolean.someone_home",
  "input_boolean.internet_connection",
  "device_tracker.iphone",
  "sensor.iphone15promax_ssid",
  "sensor.iphone15promax_bssid",
  "sensor.iphone15promax_connection_type",
  "device_tracker.fold_4",
  "sensor.fold_4_wifi_connection",
  "sensor.fold_4_wifi_bssid",
  "sensor.fold_4_public_ip_address",
  "weather.forecast_home",
  "binary_sensor.motion01",
  "binary_sensor.motion03",
  "binary_sensor.motion04spalniam",
  "automation.presence_fused_home_detection",
  "automation.tag_away",
  "automation.tag_home",
];

function iso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function summarizeState(state) {
  return {
    state: state.state,
    changed: state.last_changed,
    updated: state.last_updated,
    friendly_name: state.attributes?.friendly_name,
    last_triggered: state.attributes?.last_triggered,
    context: state.context,
  };
}

function summarizeHistory(history) {
  return history
    .filter((series) => series.length)
    .map((series) => ({
      entity_id: series[0].entity_id,
      changes: series.map((state) => ({
        state: state.state,
        changed: state.last_changed,
        updated: state.last_updated,
        last_triggered: state.attributes?.last_triggered,
        context: state.context,
      })),
    }));
}

async function maybeRest(path) {
  try {
    return await rest(path);
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

async function main() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(8, 30, 0, 0);

  const states = await rest("/api/states");
  const byEntity = Object.fromEntries(states.map((state) => [state.entity_id, state]));
  const current = Object.fromEntries(
    ENTITIES.map((entityId) => [entityId, byEntity[entityId] ? summarizeState(byEntity[entityId]) : null]),
  );

  const history = await rest(
    `/api/history/period/${iso(start)}?end_time=${encodeURIComponent(iso(now))}&filter_entity_id=${encodeURIComponent(ENTITIES.join(","))}&minimal_response=false`,
  );

  const logbookEntities = [
    "input_boolean.presence_ema_yosifova",
    "input_boolean.someone_home",
    "input_boolean.internet_connection",
    "device_tracker.iphone",
    "automation.presence_fused_home_detection",
    "automation.tag_away",
    "automation.tag_home",
  ];
  const logbook = {};
  for (const entityId of logbookEntities) {
    logbook[entityId] = await maybeRest(
      `/api/logbook/${iso(start)}?end_time=${encodeURIComponent(iso(now))}&entity=${encodeURIComponent(entityId)}`,
    );
  }

  const tagAwayConfig = await maybeRest("/api/config/automation/config/1680971970377");
  const presenceConfig = await maybeRest("/api/config/automation/config/1770077000051");

  console.log(JSON.stringify({
    checked_at: iso(now),
    period_start: iso(start),
    current,
    history: summarizeHistory(history),
    logbook,
    config_summary: {
      tag_away: {
        alias: tagAwayConfig.alias,
        trigger: tagAwayConfig.trigger,
        action: tagAwayConfig.action,
      },
      presence: {
        alias: presenceConfig.alias,
        trigger: presenceConfig.trigger,
        action_count: Array.isArray(presenceConfig.action) ? presenceConfig.action.length : null,
        description: presenceConfig.description,
      },
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
