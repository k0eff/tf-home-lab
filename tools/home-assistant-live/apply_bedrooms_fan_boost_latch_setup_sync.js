// BedroomS comfort automation: code<->live parity sync (eval 018 gaps).
//
// Two known divergences between app/stacks/home-assistant/main.tf and the
// live "[TEST] AirCon - BedroomS - room sensor comfort band" automation
// config (id 1770077000061), found during tonight's QA pass:
//
// Gap 1 - actions[1] ("Track fan-speed boost latch (error threshold
// trigger)") setup block is stale in BOTH of its value_templates
// (if[0] and else[0].if[0]). main.tf added a `fan_boost_latch_on` set-line
// and widened the `cooling_fan_mode` selector to
//   ... if (return_boost_active or fan_boost_latch_on) else ...
// Every other copy of this setup block in the live config (30 other
// locations) already carries the fix - only actions[1] was missed. Fixed by
// replacing both templates verbatim with main.tf's text.
//
// Gap 2 - choose branches [5], [6], [7]'s conditions[0].value_template each
// have a stray double space before
//   and not is_state('input_boolean.bedrooms_fixed_cooling_engaged', 'on')
// where main.tf has a single space. Fixed by writing main.tf's text over
// the live templates at those 3 sites (confirmed to be single-space-only
// divergence, not a content change - see the pre-flight diff below).
//
// choose[0] (the fixed-cooling branch that passed QA tonight) is never
// touched by this script - it is already byte-identical to main.tf.
//
// Per CLIMATE_CONTROL.md "Known Failure Modes" (the grep-for-zero rule):
// the setup block this touches is duplicated 30+ times across this
// automation's condition/action tree, so after patching we serialize the
// whole config and grep it for the OLD text, asserting the count is exactly
// zero, rather than trusting that a single successful-looking field
// assignment was the only place that needed it.
//
// Run: node apply_bedrooms_fan_boost_latch_setup_sync.js

const { rest } = require("./ha_ws_util");
const { loadRepo, safeJson } = require("./logic_model");

const AUTOMATION_ID = "1770077000061";
const AUTOMATION_ENTITY = "automation.test_aircon_bedrooms_room_sensor_comfort_band";
const FRIENDLY_NAME = "[TEST] AirCon - BedroomS - room sensor comfort band";
const RESOURCE_NAME = "test_aircon_bedrooms_room_sensor_comfort_band";
const ACTION1_ALIAS = "Track fan-speed boost latch (error threshold trigger)";
const CHOOSE_BRANCH_INDICES = [5, 6, 7];
const FIXED_COOLING_MARKER = "bedrooms_fixed_cooling_engaged";
const DOUBLE_SPACE_MARKER = "  and not is_state('input_boolean.bedrooms_fixed_cooling_engaged', 'on')";
const SINGLE_SPACE_MARKER = " and not is_state('input_boolean.bedrooms_fixed_cooling_engaged', 'on')";

// The old cooling_fan_mode selector, as a regex fragment. Deliberately does
// NOT match the new form: the new form inserts " or fan_boost_latch_on)"
// between "return_boost_active" and "else", so "return_boost_active else"
// (no intervening text) only ever matches the stale form.
const OLD_FAN_MODE_RE = /if return_boost_active else \(states\('input_number\.bedrooms_cooling_fan_mode'\) \| int\(2\)\) %\}/g;
const NEW_FAN_MODE_RE = /if \(return_boost_active or fan_boost_latch_on\) else \(states\('input_number\.bedrooms_cooling_fan_mode'\) \| int\(2\)\) %\}/g;

function assertStructure(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// ------------------------------------------------------- authoritative (code)

function loadAuthoritative() {
  const repo = loadRepo();
  const res = repo.byName.get(RESOURCE_NAME);
  assertStructure(!!res, `main.tf resource "${RESOURCE_NAME}" not found`);

  const codeActions = safeJson(res.fields.action);
  assertStructure(Array.isArray(codeActions) && codeActions.length === 4, `main.tf actions: expected length 4, found ${Array.isArray(codeActions) ? codeActions.length : typeof codeActions}`);
  assertStructure(codeActions[1].alias === ACTION1_ALIAS, `main.tf actions[1].alias mismatch: "${codeActions[1].alias}"`);

  const authIfTpl = codeActions[1].if[0].value_template;
  const authElseIfTpl = codeActions[1].else[0].if[0].value_template;
  assertStructure(authIfTpl.includes("fan_boost_latch_on"), "main.tf actions[1].if[0].value_template missing fan_boost_latch_on - repo text itself is stale?");
  assertStructure(authElseIfTpl.includes("fan_boost_latch_on"), "main.tf actions[1].else[0].if[0].value_template missing fan_boost_latch_on - repo text itself is stale?");

  const codeChooseAction = codeActions.find((a) => Array.isArray(a.choose));
  assertStructure(!!codeChooseAction, "main.tf: no top-level action with a choose block found");

  const authChoose = {};
  for (const i of CHOOSE_BRANCH_INDICES) {
    const branch = codeChooseAction.choose[i];
    assertStructure(!!branch, `main.tf choose[${i}] does not exist`);
    const tpl = branch.conditions[0].value_template;
    assertStructure(tpl.includes(FIXED_COOLING_MARKER), `main.tf choose[${i}].conditions[0].value_template missing "${FIXED_COOLING_MARKER}"`);
    assertStructure(tpl.includes(SINGLE_SPACE_MARKER), `main.tf choose[${i}].conditions[0].value_template missing expected single-space marker`);
    assertStructure(!tpl.includes(DOUBLE_SPACE_MARKER), `main.tf choose[${i}].conditions[0].value_template unexpectedly has the double-space form - repo text itself is stale?`);
    authChoose[i] = tpl;
  }

  const authChoose0 = codeChooseAction.choose[0].conditions[0].value_template;

  return { authIfTpl, authElseIfTpl, authChoose, authChoose0 };
}

// ----------------------------------------------------------------- live find

function findChooseActionIndex(config) {
  assertStructure(Array.isArray(config.actions), "live config.actions is not an array");
  const idx = config.actions.findIndex((a) => Array.isArray(a.choose));
  assertStructure(idx !== -1, "live config: no top-level action with a choose block found");
  return idx;
}

async function findAndVerifyAutomation() {
  const states = await rest("/api/states");
  const matches = states.filter((s) => s.attributes && s.attributes.friendly_name === FRIENDLY_NAME);
  assertStructure(matches.length === 1, `expected exactly 1 state with friendly_name "${FRIENDLY_NAME}", found ${matches.length}`);
  assertStructure(matches[0].entity_id === AUTOMATION_ENTITY, `entity_id mismatch: found "${matches[0].entity_id}", expected "${AUTOMATION_ENTITY}"`);
  assertStructure(String(matches[0].attributes.id) === AUTOMATION_ID, `automation id mismatch: found "${matches[0].attributes.id}", expected "${AUTOMATION_ID}"`);
}

// -------------------------------------------------------------------- diff

// Leaf-level structural diff. Returns a list of dotted/bracketed paths where
// the two trees disagree. Used to prove the patch touched exactly the 5
// fields it was supposed to and nothing else.
function diffPaths(a, b, prefix = "") {
  if (a === b) return [];
  const label = prefix || "(root)";
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) {
    return [label];
  }
  if (a === null || typeof a !== "object") return [label];
  if (Array.isArray(a)) {
    if (a.length !== b.length) return [label];
    let out = [];
    for (let i = 0; i < a.length; i += 1) out = out.concat(diffPaths(a[i], b[i], `${prefix}[${i}]`));
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let out = [];
  for (const k of keys) {
    if (!(k in a) || !(k in b)) { out.push(prefix ? `${prefix}.${k}` : k); continue; }
    out = out.concat(diffPaths(a[k], b[k], prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

// ------------------------------------------------------------------- patch

function patchConfig(config, auth, chooseIdx) {
  const patched = JSON.parse(JSON.stringify(config));

  patched.actions[1].if[0].value_template = auth.authIfTpl;
  patched.actions[1].else[0].if[0].value_template = auth.authElseIfTpl;
  for (const i of CHOOSE_BRANCH_INDICES) {
    patched.actions[chooseIdx].choose[i].conditions[0].value_template = auth.authChoose[i];
  }
  return patched;
}

if (require.main === module) {
  (async () => {
    const auth = loadAuthoritative();
    await findAndVerifyAutomation();

    const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
    assertStructure(String(config.id) === AUTOMATION_ID, `fetched config id mismatch: "${config.id}"`);
    assertStructure(Array.isArray(config.actions) && config.actions.length === 4, `live actions: expected length 4, found ${Array.isArray(config.actions) ? config.actions.length : typeof config.actions}`);
    assertStructure(config.actions[1].alias === ACTION1_ALIAS, `live actions[1].alias mismatch: "${config.actions[1].alias}"`);

    const chooseIdx = findChooseActionIndex(config);
    for (const i of CHOOSE_BRANCH_INDICES) {
      const branch = config.actions[chooseIdx].choose[i];
      assertStructure(!!branch && branch.conditions && branch.conditions[0], `live choose[${i}].conditions[0] not found`);
      assertStructure(branch.conditions[0].value_template.includes(FIXED_COOLING_MARKER), `live choose[${i}].conditions[0].value_template missing "${FIXED_COOLING_MARKER}"`);
    }
    assertStructure(!!config.actions[chooseIdx].choose[0], "live choose[0] not found");

    // ---- pre-flight: classify current state of both gaps
    const liveIfTpl = config.actions[1].if[0].value_template;
    const liveElseIfTpl = config.actions[1].else[0].if[0].value_template;
    const gap1Old = liveIfTpl.includes("if return_boost_active else") && !liveIfTpl.includes("fan_boost_latch_on")
      && liveElseIfTpl.includes("if return_boost_active else") && !liveElseIfTpl.includes("fan_boost_latch_on");
    const gap1New = liveIfTpl === auth.authIfTpl && liveElseIfTpl === auth.authElseIfTpl;
    assertStructure(gap1Old || gap1New, "gap 1: actions[1] templates are in neither the expected old form nor the expected new form - partial/unknown state, aborting rather than improvising");

    const gap2DoubleSpaceCount = CHOOSE_BRANCH_INDICES.filter((i) => config.actions[chooseIdx].choose[i].conditions[0].value_template.includes(DOUBLE_SPACE_MARKER)).length;
    const gap2Fixed = CHOOSE_BRANCH_INDICES.every((i) => config.actions[chooseIdx].choose[i].conditions[0].value_template === auth.authChoose[i]);
    assertStructure(gap2DoubleSpaceCount === 3 || gap2Fixed, `gap 2: expected all 3 branches double-spaced or all 3 already fixed, found ${gap2DoubleSpaceCount} double-spaced and gap2Fixed=${gap2Fixed} - partial/unknown state, aborting rather than improvising`);

    if (gap1New && gap2Fixed) {
      console.log(JSON.stringify({
        result: "already applied",
        gap1: "actions[1] already matches main.tf in both slots",
        gap2: "choose[5,6,7] already single-space and match main.tf",
      }, null, 2));
      process.exit(0);
    }
    assertStructure(gap1Old, `gap 1 not idempotent-clean: expected old form in both actions[1] slots before patching, found gap1New=${gap1New}`);
    assertStructure(gap2DoubleSpaceCount === 3, `gap 2 not idempotent-clean: expected exactly 3 double-space sites before patching, found ${gap2DoubleSpaceCount}`);

    // ---- patch
    const patched = patchConfig(config, auth, chooseIdx);

    // ---- step 4: grep-for-zero rule (CLIMATE_CONTROL.md Known Failure Modes)
    const patchedRaw = JSON.stringify(patched);
    const oldFormCount = (patchedRaw.match(OLD_FAN_MODE_RE) || []).length;
    const newFormCount = (patchedRaw.match(NEW_FAN_MODE_RE) || []).length;
    const doubleSpaceCount = countOccurrences(patchedRaw, DOUBLE_SPACE_MARKER);
    assertStructure(oldFormCount === 0, `grep-for-zero: old cooling_fan_mode form still present ${oldFormCount} time(s) after patch`);
    assertStructure(doubleSpaceCount === 0, `grep-for-zero: double-space marker still present ${doubleSpaceCount} time(s) after patch`);

    // ---- step 5: deep-compare - only the 5 intended fields differ
    const expectedPaths = new Set([
      "actions[1].if[0].value_template",
      "actions[1].else[0].if[0].value_template",
      ...CHOOSE_BRANCH_INDICES.map((i) => `actions[${chooseIdx}].choose[${i}].conditions[0].value_template`),
    ]);
    const diffs = diffPaths(config, patched);
    const diffSet = new Set(diffs);
    assertStructure(diffs.length === 5, `deep-compare: expected exactly 5 differing fields, found ${diffs.length}: ${JSON.stringify(diffs)}`);
    for (const p of expectedPaths) {
      assertStructure(diffSet.has(p), `deep-compare: expected diff at "${p}" but it was not found - unexpected no-op field`);
    }
    for (const p of diffs) {
      assertStructure(expectedPaths.has(p), `deep-compare: unexpected diff at "${p}" - patch touched something it shouldn't have`);
    }
    assertStructure(
      JSON.stringify(config.actions[chooseIdx].choose[0]) === JSON.stringify(patched.actions[chooseIdx].choose[0]),
      "deep-compare: choose[0] (fixed-cooling branch, QA'd tonight) is NOT byte-identical after patch - aborting",
    );

    console.log(JSON.stringify({
      preflight: { gap1Old, gap2DoubleSpaceCount },
      grepForZero: { oldFormCount, newFormCount, doubleSpaceCount },
      deepCompare: { diffCount: diffs.length, diffs, choose0Untouched: true },
    }, null, 2));

    // ---- step 6: apply + reload + verify
    await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
    await rest("/api/services/automation/reload", "POST", {});

    const verifyConfig = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
    const verifyChooseIdx = findChooseActionIndex(verifyConfig);
    assertStructure(verifyConfig.actions[1].if[0].value_template === auth.authIfTpl, "post-reload verify FAILED: actions[1].if[0].value_template does not match main.tf byte-for-byte");
    assertStructure(verifyConfig.actions[1].else[0].if[0].value_template === auth.authElseIfTpl, "post-reload verify FAILED: actions[1].else[0].if[0].value_template does not match main.tf byte-for-byte");
    for (const i of CHOOSE_BRANCH_INDICES) {
      const tpl = verifyConfig.actions[verifyChooseIdx].choose[i].conditions[0].value_template;
      assertStructure(tpl === auth.authChoose[i], `post-reload verify FAILED: choose[${i}].conditions[0].value_template does not match main.tf byte-for-byte`);
      assertStructure(!tpl.includes(DOUBLE_SPACE_MARKER), `post-reload verify FAILED: choose[${i}] still has double-space marker`);
    }
    assertStructure(
      verifyConfig.actions[verifyChooseIdx].choose[0].conditions[0].value_template === auth.authChoose0,
      "post-reload verify FAILED: choose[0] no longer matches main.tf",
    );

    console.log(JSON.stringify({
      result: "patched",
      automationId: AUTOMATION_ID,
      postReloadVerify: "actions[1] (both slots) and choose[5,6,7] byte-for-byte match main.tf; choose[0] unchanged",
    }, null, 2));
  })().catch((e) => {
    console.error("ABORTED:", e.message);
    process.exit(1);
  });
}

module.exports = {
  patchConfig, diffPaths, loadAuthoritative,
  AUTOMATION_ID, AUTOMATION_ENTITY, ACTION1_ALIAS, CHOOSE_BRANCH_INDICES,
  DOUBLE_SPACE_MARKER, SINGLE_SPACE_MARKER, OLD_FAN_MODE_RE, NEW_FAN_MODE_RE,
};
