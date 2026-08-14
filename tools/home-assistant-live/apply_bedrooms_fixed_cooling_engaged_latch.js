// BedroomS fixed-cooling dead-zone fix (2026-08-14 incident, follow-up #4).
//
// The three ordinary summer branches each stepped aside for fixed cooling using
//
//   not (summer_night_window and <toggle on> and not away)
//
// which tests INTENT ("fixed cooling ought to be in charge right now"), not FACT
// ("fixed cooling actually took charge"). Because the fixed-cooling branch is
// trigger-id gated, it gets exactly one shot per window; if that shot is missed,
// intent stays true all night while nothing is actually driving the unit. On
// 2026-08-14 the shot was missed (away was true at 19:30 due to a lagging phone
// tracker) and the room was left with no controller at all until the AC was
// switched on by hand.
//
// Fix: replace the intent test with a real latch. input_boolean
// .bedrooms_fixed_cooling_engaged is turned on by the fixed-cooling branch when
// it actually runs, and released by a new bookkeeping step as soon as the
// window/toggle/away conditions stop holding. The ordinary branches now defer
// only while the latch is on, so a missed shot leaves them free to run normally.
//
// A latch rather than an inferred signal (e.g. "unit is cooling at exactly the
// fixed target") on purpose: the ordinary summer branches compute a dynamic
// setpoint that can legitimately equal the fixed target, which would make an
// inferred signal self-latching and reintroduce the same deadlock.
//
// Ordering: run apply_bedrooms_night_fixed_cooling_presence_rearm.js first (this
// script asserts that it has been), and create the helper first with
//   node helpers_sync.js --apply --yes
//
// Run: node apply_bedrooms_fixed_cooling_engaged_latch.js

const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000061";
const AUTOMATION_ENTITY = "automation.test_aircon_bedrooms_room_sensor_comfort_band";
const LATCH = "input_boolean.bedrooms_fixed_cooling_engaged";
const PRESENCE_TRIGGER_ID = "night_fixed_cooling_presence_home";
const BRANCH_ALIAS = "Summer: night fixed-cooling — force continuous cool once at window start";
const RELEASE_ALIAS = "Track fixed-cooling engagement latch";

const OLD_CLAUSE = "not (summer_night_window and is_state('input_boolean.bedrooms_night_fixed_cooling', 'on') and not away)";
const NEW_CLAUSE = `not is_state('${LATCH}', 'on')`;
const EXPECTED_CLAUSES = 3;

// The release predicate is the negation of the old intent test - exactly the
// condition under which fixed cooling is no longer entitled to hold the unit.
const RELEASE_EXPR = `{{ ${OLD_CLAUSE} }}`;

function assertStructure(cond, msg) {
  if (!cond) throw new Error(`structure mismatch: ${msg}`);
}

// Every template in this automation recomputes its whole variable prelude from
// scratch. Reuse the fixed-cooling branch's prelude verbatim so the release step
// resolves summer_night_window / away identically, with no drift.
function preludeOf(valueTemplate) {
  const idx = valueTemplate.lastIndexOf("{{");
  assertStructure(idx > 0, "no trailing expression found in branch condition");
  return valueTemplate.slice(0, idx);
}

function patchConfig(config) {
  assertStructure(config.id === AUTOMATION_ID, "config id mismatch");
  assertStructure(
    config.triggers.some((t) => t.id === PRESENCE_TRIGGER_ID),
    "presence re-arm not applied yet — run apply_bedrooms_night_fixed_cooling_presence_rearm.js first",
  );

  const actions = config.actions;
  assertStructure(Array.isArray(actions) && actions.length === 3, "expected 3 top-level actions");
  assertStructure(!!actions[2].choose, "outer choose not found at actions[2]");
  assertStructure(
    !actions.some((a) => a.alias === RELEASE_ALIAS),
    "release step already present — already patched?",
  );

  const branch = actions[2].choose.find((c) => c.alias === BRANCH_ALIAS);
  assertStructure(!!branch, "night fixed-cooling branch not found");
  assertStructure(branch.sequence.length === 2, "unexpected fixed-cooling sequence length");
  assertStructure(
    !JSON.stringify(branch.sequence).includes(LATCH),
    "fixed-cooling branch already sets the latch",
  );

  // 1. the branch records that it actually ran
  branch.sequence.push({ action: "input_boolean.turn_on", target: { entity_id: LATCH } });

  // 2. ordinary summer branches defer to the latch, not to intent. Done before
  //    the release step is inserted: that step's own predicate is the old intent
  //    clause verbatim, so inserting it first would make it the 4th match and
  //    rewrite the very condition it needs.
  let json = JSON.stringify(config);
  const fromJson = JSON.stringify(OLD_CLAUSE).slice(1, -1);
  const toJson = JSON.stringify(NEW_CLAUSE).slice(1, -1);
  const found = json.split(fromJson).length - 1;
  assertStructure(
    found === EXPECTED_CLAUSES,
    `exclusion clause: expected ${EXPECTED_CLAUSES} occurrences, found ${found}`,
  );
  const patched = JSON.parse(json.split(fromJson).join(toJson));

  // 3. new bookkeeping step releases the latch once the window/toggle/away
  //    conditions stop holding. Inserted before the choose, matching the two
  //    existing latch trackers.
  const patchedBranch = patched.actions[2].choose.find((c) => c.alias === BRANCH_ALIAS);
  const prelude = preludeOf(patchedBranch.conditions[0].value_template);
  patched.actions.splice(2, 0, {
    alias: RELEASE_ALIAS,
    if: [{ condition: "template", value_template: prelude + RELEASE_EXPR }],
    then: [{ action: "input_boolean.turn_off", target: { entity_id: LATCH } }],
  });

  return patched;
}

if (require.main === module) {
  (async () => {
    const latch = await rest(`/api/states/${LATCH}`).catch(() => null);
    if (!latch) throw new Error(`${LATCH} does not exist live — run: node helpers_sync.js --apply --yes`);

    const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`);
    const patched = patchConfig(config);
    await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
    await rest("/api/services/automation/reload", "POST", {});
    await rest("/api/services/automation/turn_on", "POST", { entity_id: AUTOMATION_ENTITY });

    console.log(JSON.stringify({
      automation: "patched",
      latch: LATCH,
      release_step: RELEASE_ALIAS,
      exclusion_clauses_rewritten: EXPECTED_CLAUSES,
    }, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { patchConfig, OLD_CLAUSE, NEW_CLAUSE, LATCH, RELEASE_ALIAS };
