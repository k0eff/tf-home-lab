const { rest } = require("./ha_ws_util");
const { replaceSetupTemplates } = require("./sync_climate_setup_templates");

// Same template patch as sync_climate_setup_templates.js, but does not call
// automation.turn_on. Use this when the comfort automations are intentionally
// disabled (e.g. someone is running the climate manually) and you only want
// the corrected logic staged for whenever they get re-armed.
(async () => {
  const living = await rest("/api/config/automation/config/1770077000010");
  await rest("/api/config/automation/config/1770077000010", "POST", replaceSetupTemplates(living, "livingr"));
  const bed = await rest("/api/config/automation/config/1770077000021");
  await rest("/api/config/automation/config/1770077000021", "POST", replaceSetupTemplates(bed, "bedroomb"));
  await rest("/api/services/automation/reload", "POST", {});

  const states = await rest("/api/states");
  const summary = Object.fromEntries(
    states
      .filter((item) =>
        [
          "automation.test_aircon_livingr_room_sensor_comfort_band",
          "automation.test_aircon_bedroomb_room_sensor_comfort_band",
        ].includes(item.entity_id),
      )
      .map((item) => [item.entity_id, item.state]),
  );

  console.log(JSON.stringify({ updated: ["1770077000010", "1770077000021"], rearmed: false, summary }, null, 2));
})();
