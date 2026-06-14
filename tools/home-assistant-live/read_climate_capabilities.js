const { rest } = require("./ha_ws_util");

(async () => {
  const entities = ["climate.hol_2", "climate.v357_spalniag_2"];
  const states = await rest("/api/states");
  const out = {};
  for (const entity of entities) {
    const state = states.find((item) => item.entity_id === entity);
    out[entity] = {
      state: state?.state,
      temperature: state?.attributes?.temperature,
      current_temperature: state?.attributes?.current_temperature,
      hvac_modes: state?.attributes?.hvac_modes,
      fan_modes: state?.attributes?.fan_modes,
      swing_modes: state?.attributes?.swing_modes,
      fan_mode: state?.attributes?.fan_mode,
      swing_mode: state?.attributes?.swing_mode,
      min_temp: state?.attributes?.min_temp,
      max_temp: state?.attributes?.max_temp,
      target_temp_step: state?.attributes?.target_temp_step,
    };
  }
  console.log(JSON.stringify(out, null, 2));
})();
