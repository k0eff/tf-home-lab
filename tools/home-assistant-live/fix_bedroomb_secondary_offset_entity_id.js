// Repair for eval 015: apply_bedroomb_stratification_offset.js asked HA to
// create input_number.bedroomb_secondary_stratification_offset, but HA's
// websocket input_number/create ignores any requested id and derives the entity
// id from the FRIENDLY NAME. "BedroomB Ceiling Sensor Stratification Offset"
// therefore landed as
//   input_number.bedroomb_ceiling_sensor_stratification_offset
// while every template kept pointing at the intended
//   input_number.bedroomb_secondary_stratification_offset
// which does not exist. The templates' `| float(1.3)` default silently absorbed
// the miss, so nothing errored - the ceiling offset simply froze at a hardcoded
// 1.3 and never learned, and the real helper sat unused at its min of -3.
//
// The companion AC helper only escaped this because its name happens to derive
// the same id it was asked for.
//
// Fix: point the templates at the id HA actually assigned - it is the more
// descriptive name anyway, and matches what the dashboard shows - then seed the
// helper off its min onto the measured 24h mean so learning starts calibrated.
//
// Run: HA_BASE=... HA_TOKEN=... node fix_bedroomb_secondary_offset_entity_id.js

const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000021";
const AUTOMATION_ENTITY = "automation.test_aircon_bedroomb_room_sensor_comfort_band";

const WRONG = "input_number.bedroomb_secondary_stratification_offset";
const RIGHT = "input_number.bedroomb_ceiling_sensor_stratification_offset";
const SEED = 1.3;
const OFFSET_MIN = -3;
// 30 sensor-resolution chains reference it once each; the learning step
// references it twice (the EMA's own previous value, and the set_value target).
const EXPECTED = 32;

function transformStrings(node, fn) {
  if (typeof node === "string") return fn(node);
  if (Array.isArray(node)) return node.map((n) => transformStrings(n, fn));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = transformStrings(v, fn);
    return out;
  }
  return node;
}

const countOccurrences = (haystack, needle) => haystack.split(needle).length - 1;

async function main() {
  const states = await rest("/api/states", "GET");
  const right = states.find((s) => s.entity_id === RIGHT);
  const wrong = states.find((s) => s.entity_id === WRONG);
  console.log(`${RIGHT}: ${right ? right.state : "(absent)"}`);
  console.log(`${WRONG}: ${wrong ? wrong.state : "(absent)"}`);
  if (!right) throw new Error(`refusing to write: ${RIGHT} does not exist`);
  if (wrong) throw new Error(`refusing to write: ${WRONG} unexpectedly exists - resolve by hand`);

  const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
  const beforeRaw = JSON.stringify(config);
  const found = countOccurrences(beforeRaw, WRONG);
  console.log(`\ndangling references: ${found}, expected ${EXPECTED}`);
  if (found !== EXPECTED) {
    throw new Error(`refusing to write: found ${found} references, expected ${EXPECTED}`);
  }

  const patched = transformStrings(config, (s) => s.split(WRONG).join(RIGHT));
  const afterRaw = JSON.stringify(patched);
  if (countOccurrences(afterRaw, WRONG) !== 0) throw new Error("refusing to write: dangling references remain");
  if (countOccurrences(afterRaw, RIGHT) !== EXPECTED) {
    throw new Error("refusing to write: rewritten reference count does not match");
  }
  // Rename only - the id is 8 characters longer, nothing else may move.
  const expectedDelta = EXPECTED * (RIGHT.length - WRONG.length);
  if (afterRaw.length - beforeRaw.length !== expectedDelta) {
    throw new Error(`refusing to write: size delta ${afterRaw.length - beforeRaw.length}, expected ${expectedDelta}`);
  }

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);

  if (Number(right.state) === OFFSET_MIN) {
    await rest("/api/services/input_number/set_value", "POST", { entity_id: RIGHT, value: SEED });
    console.log(`seeded ${RIGHT} = ${SEED} (was sitting on its min)`);
  } else {
    console.log(`${RIGHT} already at ${right.state}, left alone`);
  }

  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/trigger", "POST", { entity_id: AUTOMATION_ENTITY });
  await new Promise((resolve) => setTimeout(resolve, 6000));

  const after = await rest("/api/states", "GET");
  const byId = Object.fromEntries(after.map((s) => [s.entity_id, s]));
  console.log("\n=== AFTER ===");
  console.log(JSON.stringify({
    ac_offset: byId["input_number.bedroomb_ac_stratification_offset"]?.state,
    ceiling_offset: byId[RIGHT]?.state,
    primary: byId["sensor.miaomiaoce_t2_5249_temperature"]?.state,
    secondary: byId["sensor.miaomiaoce_t2_faea_temperature"]?.state,
    ac_temp: byId["climate.v357_spalniag_2"]?.attributes?.current_temperature,
    automation: byId[AUTOMATION_ENTITY]?.state,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
