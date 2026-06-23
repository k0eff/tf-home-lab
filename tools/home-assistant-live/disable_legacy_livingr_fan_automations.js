const { rest } = require("./ha_ws_util");

const targets = [
  "automation.v2_aircon_livingr_fan_mid_motion",
  "automation.v2_aircon_livingr_fan_high_no_motion",
  "automation.aircon_livingr_fan_mid_motion",
  "automation.aircon_livingr_fan_high_no_motion",
];

(async () => {
  const states = await rest("/api/states");
  const existing = states
    .filter((state) => targets.includes(state.entity_id))
    .map((state) => state.entity_id);

  for (const entityId of existing) {
    await rest("/api/services/automation/turn_off", "POST", {
      entity_id: entityId,
      stop_actions: false,
    });
  }

  console.log(JSON.stringify({ disabled: existing }, null, 2));
})();
