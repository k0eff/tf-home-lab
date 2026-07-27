// BedroomS night fixed-cooling target control (2026-07-27, follow-up).
//
// The initial night-fixed-cooling implementation hardcoded the AC-setpoint
// (24C) with no UI control, inconsistent with every other comfort-band
// target in this automation (day/night/hot/mild summer targets are all
// input_number helpers). Adds input_number.bedrooms_night_fixed_cooling_target
// (default 24, matching the physical calibration offset already established —
// see apply_bedrooms_night_fixed_cooling.js) and rewires the
// climate.set_temperature action to read it via a template instead of the
// literal 24.
//
// Run: node apply_bedrooms_night_fixed_cooling_target_control.js

const { connectWs, rest } = require("./ha_ws_util");
const { ensureInputNumber } = require("./apply_fan_speed_boost");

const AUTOMATION_ID = "1770077000061";
const CLIMATE_ENTITY = "climate.v537_spalniam_2";
const TARGET_ID = "bedrooms_night_fixed_cooling_target";
const BRANCH_ALIAS = "Summer: night fixed-cooling — force continuous cool once at window start";

function assertStructure(cond, msg) {
  if (!cond) throw new Error(`structure mismatch: ${msg}`);
}

function patchConfig(config) {
  assertStructure(config.id === AUTOMATION_ID, "config id mismatch");
  assertStructure(config.actions[2] && Array.isArray(config.actions[2].choose), "choose array not at actions[2]");

  const choose = config.actions[2].choose;
  const branch = choose.find((c) => c.alias === BRANCH_ALIAS);
  assertStructure(!!branch, "night fixed-cooling branch not found");

  const setTemp = branch.sequence.find((s) => s.action === "climate.set_temperature");
  assertStructure(!!setTemp, "climate.set_temperature action not found in branch");
  assertStructure(setTemp.data.temperature === 24, "expected hardcoded temperature 24 — already patched?");

  setTemp.data.temperature = `{{ states('input_number.${TARGET_ID}') | float(24) }}`;

  return config;
}

if (require.main === module) {
  (async () => {
    const ws = await connectWs();
    const helperResult = await ensureInputNumber(
      ws,
      TARGET_ID,
      "BedroomS Night Fixed Cooling Target",
      18,
      30,
      0.5,
      24,
      "°C",
    );

    const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`);
    const patched = patchConfig(config);
    await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
    await rest("/api/services/automation/reload", "POST", {});
    await rest("/api/services/automation/turn_on", "POST", {
      entity_id: "automation.test_aircon_bedrooms_room_sensor_comfort_band",
    });

    ws.close();
    console.log(JSON.stringify({ helper: helperResult, automation: "patched" }, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { patchConfig, TARGET_ID };
