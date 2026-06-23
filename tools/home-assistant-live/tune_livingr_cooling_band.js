const { rest } = require("./ha_ws_util");

const SETTINGS = [
  {
    entity_id: "input_number.livingr_cooling_start_delta",
    value: 0.3,
  },
];

const ENTITIES = [
  "climate.hol_2",
  "automation.test_aircon_livingr_room_sensor_comfort_band",
  "input_number.livingr_target_temperature",
  "input_number.livingr_cooling_start_delta",
  "input_number.livingr_cooling_overshoot",
  "sensor.miaomiaoce_t2_1228_temperature_humidity_sensor",
  "input_boolean.livingr_manual_override",
  "input_boolean.livingr_program_requested",
];

function trimState(state) {
  return {
    state: state.state,
    updated: state.last_updated,
    temperature: state.attributes?.temperature,
    current_temperature: state.attributes?.current_temperature,
    fan_mode: state.attributes?.fan_mode,
    friendly_name: state.attributes?.friendly_name,
  };
}

async function readStates() {
  const states = await Promise.all(
    ENTITIES.map(async (entityId) => [entityId, trimState(await rest(`/api/states/${entityId}`))]),
  );
  return Object.fromEntries(states);
}

async function main() {
  const before = await readStates();

  for (const setting of SETTINGS) {
    await rest("/api/services/input_number/set_value", "POST", setting);
  }

  await rest("/api/services/automation/trigger", "POST", {
    entity_id: "automation.test_aircon_livingr_room_sensor_comfort_band",
    skip_condition: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));
  const after = await readStates();

  console.log(JSON.stringify({
    changed: SETTINGS,
    before,
    after,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
