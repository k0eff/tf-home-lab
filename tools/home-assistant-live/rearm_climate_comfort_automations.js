const { rest } = require("./ha_ws_util");

const ROOMS = [
  {
    name: "LivingR",
    automation: "automation.test_aircon_livingr_room_sensor_comfort_band",
    climate: "climate.hol_2",
  },
  {
    name: "BedroomB",
    automation: "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    climate: "climate.v357_spalniag_2",
  },
];

async function getState(entityId) {
  return rest(`/api/states/${entityId}`);
}

(async () => {
  const before = {};
  for (const room of ROOMS) {
    const [automation, climate] = await Promise.all([
      getState(room.automation),
      getState(room.climate),
    ]);
    before[room.name] = {
      automation: {
        state: automation.state,
        last_triggered: automation.attributes?.last_triggered || null,
      },
      climate: {
        state: climate.state,
        current_temperature: climate.attributes?.current_temperature ?? null,
        target_temperature: climate.attributes?.temperature ?? null,
        fan_mode: climate.attributes?.fan_mode ?? null,
      },
    };
  }

  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/turn_off", "POST", {
    entity_id: ROOMS.map((room) => room.automation),
    stop_actions: true,
  });
  await rest("/api/services/automation/turn_on", "POST", {
    entity_id: ROOMS.map((room) => room.automation),
  });

  for (const room of ROOMS) {
    await rest("/api/services/automation/trigger", "POST", {
      entity_id: room.automation,
      skip_condition: false,
    });
  }

  const after = {};
  for (const room of ROOMS) {
    const [automation, climate] = await Promise.all([
      getState(room.automation),
      getState(room.climate),
    ]);
    after[room.name] = {
      automation: {
        state: automation.state,
        last_triggered: automation.attributes?.last_triggered || null,
      },
      climate: {
        state: climate.state,
        current_temperature: climate.attributes?.current_temperature ?? null,
        target_temperature: climate.attributes?.temperature ?? null,
        fan_mode: climate.attributes?.fan_mode ?? null,
      },
    };
  }

  console.log(JSON.stringify({ before, after }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
