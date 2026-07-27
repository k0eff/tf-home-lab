// BedroomS night fixed-cooling toggle-trigger fix (2026-07-27, follow-up #2).
//
// Original design only fired at the fixed 19:30 time trigger (edge-triggered,
// no self-heal). User toggled the input_boolean on at 20:54 — after today's
// 19:30 trigger had already fired — and the AC never turned on, since the
// branch's condition only evaluates on that specific trigger.id. Adds a
// second trigger (state: toggle off->on) so flipping the toggle on mid-window
// also forces cooling immediately, not just at tomorrow's 19:30. Condition
// gains an explicit summer_night_window check (previously implied only by
// trigger.id == the 19:30 trigger) so toggling on outside the window does
// nothing.
//
// Run: node apply_bedrooms_night_fixed_cooling_toggle_trigger.js

const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000061";
const CLIMATE_ENTITY = "climate.v537_spalniam_2";
const TOGGLE_TRIGGER_ID = "night_fixed_cooling_toggle_on";
const TIME_TRIGGER_ID = "summer_night_fixed_cooling_start";
const BRANCH_ALIAS = "Summer: night fixed-cooling — force continuous cool once at window start";

const OLD_TAIL = `trigger.id == '${TIME_TRIGGER_ID}' and climate_mode == 'summer' and is_state('input_boolean.bedrooms_night_fixed_cooling', 'on') and not away }}`;
const NEW_TAIL = `trigger.id in ['${TIME_TRIGGER_ID}', '${TOGGLE_TRIGGER_ID}'] and climate_mode == 'summer' and summer_night_window and is_state('input_boolean.bedrooms_night_fixed_cooling', 'on') and not away }}`;

function assertStructure(cond, msg) {
  if (!cond) throw new Error(`structure mismatch: ${msg}`);
}

function patchConfig(config) {
  assertStructure(config.id === AUTOMATION_ID, "config id mismatch");

  const triggers = config.triggers;
  assertStructure(Array.isArray(triggers), "trigger array not found");
  assertStructure(
    !triggers.some((t) => t.id === TOGGLE_TRIGGER_ID),
    "toggle trigger already present — already patched?",
  );
  triggers.push({
    platform: "state",
    entity_id: "input_boolean.bedrooms_night_fixed_cooling",
    to: "on",
    id: TOGGLE_TRIGGER_ID,
  });

  const choose = config.actions[2].choose;
  const branch = choose.find((c) => c.alias === BRANCH_ALIAS);
  assertStructure(!!branch, "night fixed-cooling branch not found");
  const cond = branch.conditions[0];
  assertStructure(cond.value_template.includes(OLD_TAIL), "expected old condition tail not found — already patched?");
  cond.value_template = cond.value_template.replace(OLD_TAIL, NEW_TAIL);

  return config;
}

if (require.main === module) {
  (async () => {
    const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`);
    const patched = patchConfig(config);
    await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
    await rest("/api/services/automation/reload", "POST", {});
    await rest("/api/services/automation/turn_on", "POST", {
      entity_id: "automation.test_aircon_bedrooms_room_sensor_comfort_band",
    });

    console.log(JSON.stringify({ automation: "patched" }, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { patchConfig, OLD_TAIL, NEW_TAIL };
