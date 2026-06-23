const { rest } = require("./ha_ws_util");

function iso(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function trimState(s) {
  return {
    state: s.state,
    changed: s.last_changed,
    updated: s.last_updated,
    temperature: s.attributes?.temperature,
    current_temperature: s.attributes?.current_temperature,
    fan_mode: s.attributes?.fan_mode,
    hvac_modes: s.attributes?.hvac_modes,
    friendly_name: s.attributes?.friendly_name,
  };
}

function summarizeClimateEvent(s) {
  return {
    changed: s.last_changed,
    state: s.state,
    temperature: s.attributes?.temperature,
    current_temperature: s.attributes?.current_temperature,
    fan_mode: s.attributes?.fan_mode,
  };
}

function summarizeMotionEvent(s) {
  return {
    changed: s.last_changed,
    state: s.state,
  };
}

async function main() {
  const now = new Date();
  const start = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const entityIds = [
    "climate.hol_2",
    "binary_sensor.motion01",
    "automation.test_aircon_livingr_room_sensor_comfort_band",
    "automation.v2_aircon_livingr_fan_mid_motion",
    "input_number.livingr_cooling_fan_mode",
    "input_number.livingr_target_temperature",
    "input_number.livingr_hot_summer_target",
    "input_number.livingr_cooling_start_delta",
    "input_number.livingr_cooling_overshoot",
    "input_number.livingr_coil_cooldown_minutes",
    "input_boolean.livingr_program_requested",
    "input_boolean.livingr_manual_override",
    "sensor.miaomiaoce_t2_1228_temperature_humidity_sensor",
    "sensor.miaomiaoce_t2_1228_battery_level",
    "weather.forecast_home",
    "sensor.venti_outside_temperature",
  ];

  const [states, comfortConfig, midMotionConfig, history] = await Promise.all([
    rest("/api/states"),
    rest("/api/config/automation/config/1770077000010"),
    rest("/api/config/automation/config/169948017641299"),
    rest(
      `/api/history/period/${iso(start)}?end_time=${encodeURIComponent(iso(now))}&filter_entity_id=${encodeURIComponent("climate.hol_2,binary_sensor.motion01,automation.test_aircon_livingr_room_sensor_comfort_band")}&minimal_response=false`,
    ),
  ]);

  const current = Object.fromEntries(
    states
      .filter((s) => entityIds.includes(s.entity_id))
      .map((s) => [s.entity_id, trimState(s)]),
  );

  const byEntity = Object.fromEntries(
    history
      .filter((series) => series.length)
      .map((series) => {
        const entityId = series[0].entity_id;
        if (entityId === "climate.hol_2") {
          return [entityId, series.map(summarizeClimateEvent)];
        }
        return [entityId, series.map(summarizeMotionEvent)];
      }),
  );

  const comfortBranches = (comfortConfig.action?.[0]?.choose || []).map((branch) => ({
    alias: branch.alias,
    conditions: branch.conditions,
    services: (branch.sequence || []).map((step) => ({
      service: step.service,
      hvac_mode: step.data?.hvac_mode,
      fan_mode: step.data?.fan_mode,
      temperature: step.data?.temperature,
    })),
  }));

  console.log(JSON.stringify({
    now: now.toISOString(),
    current,
    comfort_branches: comfortBranches.filter((x) => /Daytime|Summer/.test(x.alias || "")),
    mid_motion_automation: {
      alias: midMotionConfig.alias,
      trigger: midMotionConfig.trigger,
      condition: midMotionConfig.condition,
      action: midMotionConfig.action,
    },
    recent_history: byEntity,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
