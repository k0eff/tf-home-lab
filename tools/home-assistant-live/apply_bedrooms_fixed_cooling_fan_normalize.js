// BedroomS fixed-cooling: normalize fan speed at window-start handover.
//
// "Summer: night fixed-cooling — force continuous cool once at window start"
// (branch 0 of the top-level choose) sets hvac_mode + a fixed target
// temperature, then latches input_boolean.bedrooms_fixed_cooling_engaged --
// but never touches fan_mode. Whatever fan speed the unit happens to be on
// at 19:30 handover (e.g. a leftover device-side fan 5) persists all night,
// which for BedroomS also inverts the AC-sensor-vs-room calibration that the
// fixed target of 24.0 relies on.
//
// Fix: insert a climate.set_fan_mode action between set_temperature and the
// input_boolean.turn_on latch step, driving fan_mode from the PLAIN
// input_number.bedrooms_cooling_fan_mode helper -- deliberately NOT the
// boost-resolved `cooling_fan_mode` setup variable. Fixed cooling disengages
// the ordinary comfort program, and a latched fan-boost from earlier in the
// evening (fan_boost_active) would otherwise pin fan 5 all night if the boost
// variable were used instead.
//
// Run: node apply_bedrooms_fixed_cooling_fan_normalize.js

const { rest } = require("./ha_ws_util");

const FRIENDLY_NAME = "[TEST] AirCon - BedroomS - room sensor comfort band";
const CLIMATE_ENTITY = "climate.v537_spalniam_2";
const BRANCH_ALIAS = "Summer: night fixed-cooling — force continuous cool once at window start";

const NEW_ACTION = {
  action: "climate.set_fan_mode",
  target: { entity_id: CLIMATE_ENTITY },
  data: { fan_mode: "{{ states('input_number.bedrooms_cooling_fan_mode') | int(2) }}" },
};

const EXPECTED_SEQUENCE = [
  { action: "climate.set_hvac_mode" },
  { action: "climate.set_temperature" },
  { action: "input_boolean.turn_on" },
];

function assertStructure(cond, msg) {
  if (!cond) throw new Error(`structure mismatch: ${msg}`);
}

async function findAutomationId() {
  const states = await rest("/api/states");
  const matches = states.filter((s) => s.attributes && s.attributes.friendly_name === FRIENDLY_NAME);
  assertStructure(matches.length === 1, `expected exactly 1 state with friendly_name "${FRIENDLY_NAME}", found ${matches.length}`);
  const id = matches[0].attributes.id;
  assertStructure(!!id, "matched state has no attributes.id");
  return { automationEntity: matches[0].entity_id, automationId: id };
}

function findBranch(config) {
  assertStructure(Array.isArray(config.actions), "config.actions is not an array");
  const chooseAction = config.actions.find((a) => Array.isArray(a.choose));
  assertStructure(!!chooseAction, "no top-level action with a choose block found");
  const branch = chooseAction.choose.find((c) => typeof c.alias === "string" && c.alias.includes("night fixed-cooling"));
  assertStructure(!!branch, 'no choose branch with alias containing "night fixed-cooling" found');
  return branch;
}

function alreadyApplied(branch) {
  return branch.sequence.some((a) => a.action === "climate.set_fan_mode");
}

function assertExpectedSequence(branch) {
  const seq = branch.sequence;
  assertStructure(Array.isArray(seq) && seq.length === EXPECTED_SEQUENCE.length, `expected ${EXPECTED_SEQUENCE.length}-action sequence, found ${Array.isArray(seq) ? seq.length : typeof seq}`);
  EXPECTED_SEQUENCE.forEach((expected, i) => {
    assertStructure(seq[i].action === expected.action, `sequence[${i}].action expected "${expected.action}", found "${seq[i].action}"`);
  });
}

function patchConfig(config) {
  const branch = findBranch(config);

  if (alreadyApplied(branch)) {
    return { patched: null, branch };
  }

  assertExpectedSequence(branch);

  const before = JSON.parse(JSON.stringify(branch.sequence));
  branch.sequence.splice(2, 0, NEW_ACTION);
  assertStructure(branch.sequence.length === 4, "post-splice sequence length is not 4");
  assertStructure(branch.sequence[2].action === "climate.set_fan_mode", "post-splice sequence[2] is not climate.set_fan_mode");

  return { patched: config, branch, before, after: branch.sequence };
}

if (require.main === module) {
  (async () => {
    const { automationEntity, automationId } = await findAutomationId();
    console.log(`Found automation: ${automationEntity} (id=${automationId})`);

    const config = await rest(`/api/config/automation/config/${automationId}`);
    const branchBefore = findBranch(config);

    if (alreadyApplied(branchBefore)) {
      console.log("already applied");
      console.log("Branch sequence (unchanged):");
      console.log(JSON.stringify(branchBefore.sequence, null, 2));
      process.exit(0);
    }

    assertExpectedSequence(branchBefore);
    const before = JSON.parse(JSON.stringify(branchBefore.sequence));

    branchBefore.sequence.splice(2, 0, NEW_ACTION);
    assertStructure(branchBefore.sequence.length === 4, "post-splice sequence length is not 4");
    assertStructure(branchBefore.sequence[2].action === "climate.set_fan_mode", "post-splice sequence[2] is not climate.set_fan_mode");

    await rest(`/api/config/automation/config/${automationId}`, "POST", config);
    await rest("/api/services/automation/reload", "POST", {});

    const verifyConfig = await rest(`/api/config/automation/config/${automationId}`);
    const verifyBranch = findBranch(verifyConfig);
    assertStructure(verifyBranch.sequence.length === 4, `verify: expected 4 actions after reload, found ${verifyBranch.sequence.length}`);
    assertStructure(verifyBranch.sequence[2].action === "climate.set_fan_mode", "verify: sequence[2] is not climate.set_fan_mode after reload");

    console.log("Branch sequence BEFORE:");
    console.log(JSON.stringify(before, null, 2));
    console.log("Branch sequence AFTER (verified via re-GET):");
    console.log(JSON.stringify(verifyBranch.sequence, null, 2));
    console.log(JSON.stringify({ automation: "patched", branchAlias: BRANCH_ALIAS, automationId }, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { patchConfig, findAutomationId, findBranch, alreadyApplied, NEW_ACTION, FRIENDLY_NAME, BRANCH_ALIAS };
