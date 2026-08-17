// BedroomS fixed-cooling: gate handover + engagement latch on hard_away
// (presence-only), not the shared away variable (presence-or-no-motion).
//
// "[TEST] AirCon - BedroomS - room sensor comfort band" computes a shared
// `away = allow_away_saving and (away_by_presence or away_by_no_motion) and
// motion_quiet_30m` in its (duplicated) setup block. away_by_no_motion goes
// true whenever the whole house sits still for 30+ minutes -- which is what
// happens shortly after everyone falls asleep, not a real absence.
//
// Two templates in this automation gate on that shared `away`:
//
// 1. Branch 0 ("Summer: night fixed-cooling -- force continuous cool once at
//    window start") condition -- decides whether the 19:30 (or toggle-on /
//    presence-home) handover is allowed to fire.
// 2. The "Track fixed-cooling engagement latch" tracker action -- turns
//    input_boolean.bedrooms_fixed_cooling_engaged off once the branch-0
//    intent (window/toggle/away) stops holding.
//
// Because both used the whole-house `away` (which includes no-motion),
// everyone falling asleep flipped the latch off mid-sleep, and nothing
// re-armed it until morning -- room fell back to full proportional
// on/off/fan_only cycling all night (confirmed live incident 2026-08-16
// 23:48:15, the reported flickering temperature).
//
// Fix: in exactly these two templates, add a presence-only variable
// alongside (not replacing) the shared `away`:
//
//   {% set hard_away = allow_away_saving and away_by_presence %}
//
// and change each template's *final* gating expression from `not away` to
// `not hard_away`. The shared `away` variable's own definition, and every
// other one of its 20-30+ uses elsewhere in this automation (away_relax_delta,
// dynamic_setpoint, other branches), is left untouched.
//
// Known failure mode (see CLIMATE_CONTROL.md "Known Failure Modes"): the
// `{% set %}` setup block is duplicated verbatim in every top-level
// condition/action template in this automation -- there is no shared
// `locals`/macro at the live-HA level. A patch that finds "the" away-set
// line via a single match and edits only that copy silently leaves every
// other copy (and any other template referencing away) wrong. This script
// grep-for-zero verifies the full fetched config JSON after editing: the
// pre-patch template count of "and not away" must be exactly 2, and after
// the edit, the literal "{% set hard_away = ... %}" line must appear
// exactly 2 times in the whole config (one per patched template) and
// nowhere else.
//
// Run: node apply_bedrooms_fixed_cooling_hard_away.js

const { rest } = require("./ha_ws_util");

const FRIENDLY_NAME = "[TEST] AirCon - BedroomS - room sensor comfort band";
const BRANCH_ALIAS = "Summer: night fixed-cooling — force continuous cool once at window start";
const TRACKER_ALIAS = "Track fixed-cooling engagement latch";
const LATCH_ENTITY = "input_boolean.bedrooms_fixed_cooling_engaged";

// Exact text of the shared away-set line, as it appears (verbatim, duplicated)
// in every setup block across this automation. Anchor for inserting the new
// hard_away line right after it, same style/indentation as surrounding
// {% set ... %} lines (this automation's templates are single-line/space-joined,
// so "same style" means: another {% set ... %} clause immediately following).
const AWAY_SET_LINE =
  "{% set away = allow_away_saving and (away_by_presence or away_by_no_motion) and motion_quiet_30m %}";

const HARD_AWAY_LINE = "{% set hard_away = allow_away_saving and away_by_presence %}";

// Final gating expressions differ in shape between the two templates (the
// branch condition is a flat `and` chain; the tracker's is wrapped in a
// `not (...)` group), so each gets its own exact old/new snippet.
const BRANCH_OLD_FINAL = "and not away }}";
const BRANCH_NEW_FINAL = "and not hard_away }}";

const TRACKER_OLD_FINAL = "and not away) }}";
const TRACKER_NEW_FINAL = "and not hard_away) }}";

function assertStructure(cond, msg) {
  if (!cond) throw new Error(`structure mismatch: ${msg}`);
}

function countOccurrences(haystack, needle) {
  if (needle === "") return 0;
  let count = 0;
  let idx = 0;
  for (;;) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count += 1;
    idx += needle.length;
  }
  return count;
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
  assertStructure(Array.isArray(branch.conditions) && branch.conditions.length === 1, `expected branch 0 to have exactly 1 condition, found ${Array.isArray(branch.conditions) ? branch.conditions.length : typeof branch.conditions}`);
  assertStructure(branch.conditions[0].condition === "template", 'branch 0 condition[0] is not a "template" condition');
  return branch;
}

function findTrackerAction(config) {
  assertStructure(Array.isArray(config.actions), "config.actions is not an array");
  const action = config.actions.find((a) => a.alias === TRACKER_ALIAS);
  assertStructure(!!action, `no top-level action with alias "${TRACKER_ALIAS}" found`);
  assertStructure(Array.isArray(action.if) && action.if.length === 1, `expected tracker action "if" to have exactly 1 entry, found ${Array.isArray(action.if) ? action.if.length : typeof action.if}`);
  assertStructure(action.if[0].condition === "template", 'tracker action if[0] is not a "template" condition');
  assertStructure(Array.isArray(action.then) && action.then.length === 1, `expected tracker action "then" to have exactly 1 entry, found ${Array.isArray(action.then) ? action.then.length : typeof action.then}`);
  assertStructure(action.then[0].action === "input_boolean.turn_off", `expected tracker action then[0].action to be "input_boolean.turn_off", found "${action.then[0].action}"`);
  assertStructure(action.then[0].target && action.then[0].target.entity_id === LATCH_ENTITY, `expected tracker action then[0] to target "${LATCH_ENTITY}"`);
  return action;
}

// A template only counts as "already applied" if it has both the hard_away
// set-line AND its final gating expression actually uses hard_away (either
// shape -- branch's flat "and not hard_away }}" or the tracker's wrapped
// "and not hard_away) }}"). Checking the set-line alone would treat a
// half-mangled template (set-line inserted but final expression still bare
// "away") as already applied and silently no-op instead of erroring on the
// inconsistent state.
function alreadyApplied(templateText) {
  const hasSetLine = templateText.includes(HARD_AWAY_LINE);
  const hasHardAwayGate = templateText.includes(BRANCH_NEW_FINAL) || templateText.includes(TRACKER_NEW_FINAL);
  return hasSetLine && hasHardAwayGate;
}

// Locate every string leaf in the config whose text contains `needle`,
// returning {path, text} pairs. Used both for the pre-patch "exactly 2
// occurrences" assertion and for the post-patch "hard_away appears nowhere
// else" assertion.
function findStringLeaves(obj, needle, path, results) {
  if (typeof obj === "string") {
    if (obj.includes(needle)) results.push({ path, text: obj });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => findStringLeaves(v, needle, `${path}[${i}]`, results));
  } else if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj)) findStringLeaves(obj[k], needle, `${path}.${k}`, results);
  }
}

// Full-config string-leaf diff: returns paths whose string content differs
// between two config trees with identical shape.
function diffStringLeaves(before, after, path, results) {
  if (typeof before === "string" || typeof after === "string") {
    if (before !== after) results.push({ path, before, after });
    return;
  }
  if (Array.isArray(before)) {
    const len = Math.max(before.length, Array.isArray(after) ? after.length : 0);
    for (let i = 0; i < len; i += 1) diffStringLeaves(before[i], after ? after[i] : undefined, `${path}[${i}]`, results);
  } else if (before && typeof before === "object") {
    const keys = new Set([...Object.keys(before), ...(after ? Object.keys(after) : [])]);
    for (const k of keys) diffStringLeaves(before[k], after ? after[k] : undefined, `${path}.${k}`, results);
  } else if (before !== after) {
    results.push({ path, before, after });
  }
}

function patchTemplateText(templateText, oldFinal, newFinal, label) {
  assertStructure(countOccurrences(templateText, AWAY_SET_LINE) === 1, `${label}: expected exactly 1 occurrence of the away-set line, found ${countOccurrences(templateText, AWAY_SET_LINE)}`);
  assertStructure(countOccurrences(templateText, oldFinal) === 1, `${label}: expected exactly 1 occurrence of "${oldFinal}", found ${countOccurrences(templateText, oldFinal)}`);

  const withHardAway = templateText.replace(AWAY_SET_LINE, `${AWAY_SET_LINE}\n${HARD_AWAY_LINE}`);
  assertStructure(countOccurrences(withHardAway, HARD_AWAY_LINE) === 1, `${label}: hard_away insertion did not land exactly once`);

  const patched = withHardAway.replace(oldFinal, newFinal);
  assertStructure(countOccurrences(patched, newFinal) === 1, `${label}: final expression replacement did not land exactly once`);
  assertStructure(!patched.includes(oldFinal), `${label}: old final expression "${oldFinal}" still present after patch`);

  return patched;
}

if (require.main === module) {
  (async () => {
    const { automationEntity, automationId } = await findAutomationId();
    console.log(`Found automation: ${automationEntity} (id=${automationId})`);

    const config = await rest(`/api/config/automation/config/${automationId}`);
    const originalConfig = JSON.parse(JSON.stringify(config));

    const branch = findBranch(config);
    const tracker = findTrackerAction(config);

    const branchTemplate = branch.conditions[0].value_template;
    const trackerTemplate = tracker.if[0].value_template;

    console.log("=== ORIGINAL Branch 0 condition value_template ===");
    console.log(branchTemplate);
    console.log();
    console.log("=== ORIGINAL Tracker action if[0] value_template ===");
    console.log(trackerTemplate);
    console.log();

    // Idempotency check first (mirrors the reference script): if both
    // templates already carry hard_away, no-op cleanly before running the
    // strict pre-patch "exactly 2 occurrences of and not away" assertion --
    // that assertion is only valid for the unpatched state, since a
    // successful prior run legitimately drives that count to 0.
    if (alreadyApplied(branchTemplate) && alreadyApplied(trackerTemplate)) {
      console.log("already applied to both templates -- no-op");
      console.log(JSON.stringify({ automation: "unchanged", automationId, reason: "hard_away already present in both templates" }, null, 2));
      process.exit(0);
    }
    assertStructure(!alreadyApplied(branchTemplate) && !alreadyApplied(trackerTemplate), "hard_away present in exactly one of the two templates -- inconsistent state, STOPPING");

    // Step 2: count occurrences of "and not away" across the whole fetched
    // config JSON. Must be exactly 2, and both must belong to the two
    // templates we just identified (not some other copy of the setup block).
    const fullConfigStr = JSON.stringify(config);
    const awayGateMatches = [];
    findStringLeaves(config, "and not away", "config", awayGateMatches);
    console.log(`Occurrences of "and not away" in full config: ${awayGateMatches.length}`);
    awayGateMatches.forEach((m) => console.log(`  - ${m.path}`));
    assertStructure(awayGateMatches.length === 2, `expected exactly 2 occurrences of "and not away" in full config, found ${awayGateMatches.length} -- STOPPING, not guessing`);
    assertStructure(countOccurrences(fullConfigStr, "and not away") === 2, `expected exactly 2 raw-string occurrences of "and not away", found ${countOccurrences(fullConfigStr, "and not away")}`);

    const branchIsMatch = awayGateMatches.some((m) => m.text === branchTemplate);
    const trackerIsMatch = awayGateMatches.some((m) => m.text === trackerTemplate);
    assertStructure(branchIsMatch, "branch-0 condition template does not contain \"and not away\" -- identification mismatch");
    assertStructure(trackerIsMatch, "tracker action template does not contain \"and not away\" -- identification mismatch");

    // Step 3: apply the two edits.
    const branchPatched = patchTemplateText(branchTemplate, BRANCH_OLD_FINAL, BRANCH_NEW_FINAL, "branch-0 condition");
    const trackerPatched = patchTemplateText(trackerTemplate, TRACKER_OLD_FINAL, TRACKER_NEW_FINAL, "tracker action if[0]");

    branch.conditions[0].value_template = branchPatched;
    tracker.if[0].value_template = trackerPatched;

    console.log("=== NEW Branch 0 condition value_template ===");
    console.log(branchPatched);
    console.log();
    console.log("=== NEW Tracker action if[0] value_template ===");
    console.log(trackerPatched);
    console.log();

    // Step 4: grep-for-zero in the two target templates specifically.
    assertStructure(!branchPatched.includes(BRANCH_OLD_FINAL), "branch-0: old \"and not away }}\" still present");
    assertStructure(!trackerPatched.includes(TRACKER_OLD_FINAL), "tracker: old \"and not away) }}\" still present");
    assertStructure(branchPatched.includes(BRANCH_NEW_FINAL), "branch-0: new \"and not hard_away }}\" missing");
    assertStructure(trackerPatched.includes(TRACKER_NEW_FINAL), "tracker: new \"and not hard_away) }}\" missing");

    const patchedConfigStr = JSON.stringify(config);
    const hardAwaySetLineMatches = [];
    findStringLeaves(config, HARD_AWAY_LINE, "config", hardAwaySetLineMatches);
    assertStructure(countOccurrences(patchedConfigStr, HARD_AWAY_LINE) === 2, `expected exactly 2 occurrences of the hard_away set-line in full patched config, found ${countOccurrences(patchedConfigStr, HARD_AWAY_LINE)}`);
    assertStructure(hardAwaySetLineMatches.length === 2, `expected exactly 2 string leaves containing the hard_away set-line, found ${hardAwaySetLineMatches.length}`);

    // hard_away (the bare word) must appear in exactly these two templates
    // and nowhere else in the config.
    const hardAwayWordMatches = [];
    findStringLeaves(config, "hard_away", "config", hardAwayWordMatches);
    assertStructure(hardAwayWordMatches.length === 2, `expected "hard_away" to appear in exactly 2 string leaves, found ${hardAwayWordMatches.length}`);
    assertStructure(hardAwayWordMatches.every((m) => m.text === branchPatched || m.text === trackerPatched), '"hard_away" leaked into a template other than the two intended ones');

    assertStructure(countOccurrences(patchedConfigStr, "and not away") === 0, `expected 0 remaining occurrences of "and not away" after patch, found ${countOccurrences(patchedConfigStr, "and not away")}`);

    // Step 5: full-config diff against the pre-patch fetch -- only the two
    // intended template strings may differ, everywhere else must be
    // byte-for-byte unchanged.
    const diffs = [];
    diffStringLeaves(originalConfig, config, "config", diffs);
    console.log(`Full-config diff: ${diffs.length} changed leaf(ves)`);
    diffs.forEach((d) => console.log(`  - ${d.path}`));
    assertStructure(diffs.length === 2, `expected exactly 2 changed leaves in full-config diff, found ${diffs.length} -- STOPPING`);
    const diffPaths = diffs.map((d) => d.path).sort();
    const expectedPaths = [
      diffs.find((d) => d.after === branchPatched) ? diffs.find((d) => d.after === branchPatched).path : null,
      diffs.find((d) => d.after === trackerPatched) ? diffs.find((d) => d.after === trackerPatched).path : null,
    ].filter(Boolean).sort();
    assertStructure(expectedPaths.length === 2, "could not match both diffed leaves back to the two patched templates");
    assertStructure(JSON.stringify(diffPaths) === JSON.stringify(expectedPaths), "diffed leaf paths do not exactly match the two intended template locations");

    // Every other "away" occurrence (20-30+) must be untouched -- verified
    // implicitly by the diff check above (only 2 leaves changed at all), but
    // also spot-check the shared away-set line count is unchanged.
    const beforeAwaySetCount = countOccurrences(JSON.stringify(originalConfig), AWAY_SET_LINE);
    const afterAwaySetCount = countOccurrences(patchedConfigStr, AWAY_SET_LINE);
    assertStructure(beforeAwaySetCount === afterAwaySetCount, `shared away-set line count changed: before=${beforeAwaySetCount} after=${afterAwaySetCount}`);
    console.log(`Shared "{% set away = ... %}" line count unchanged: ${beforeAwaySetCount} occurrences before and after.`);

    // Step 6: POST + reload + re-verify.
    await rest(`/api/config/automation/config/${automationId}`, "POST", config);
    await rest("/api/services/automation/reload", "POST", {});

    const verifyConfig = await rest(`/api/config/automation/config/${automationId}`);
    const verifyBranch = findBranch(verifyConfig);
    const verifyTracker = findTrackerAction(verifyConfig);
    const verifyBranchTemplate = verifyBranch.conditions[0].value_template;
    const verifyTrackerTemplate = verifyTracker.if[0].value_template;

    assertStructure(alreadyApplied(verifyBranchTemplate), "verify: hard_away set-line missing from branch-0 condition after reload");
    assertStructure(alreadyApplied(verifyTrackerTemplate), "verify: hard_away set-line missing from tracker action after reload");
    assertStructure(verifyBranchTemplate.includes(BRANCH_NEW_FINAL), "verify: branch-0 final expression does not use hard_away after reload");
    assertStructure(verifyTrackerTemplate.includes(TRACKER_NEW_FINAL), "verify: tracker final expression does not use hard_away after reload");
    assertStructure(!verifyBranchTemplate.includes(BRANCH_OLD_FINAL), "verify: branch-0 still has bare \"and not away }}\" after reload");
    assertStructure(!verifyTrackerTemplate.includes(TRACKER_OLD_FINAL), "verify: tracker still has bare \"and not away) }}\" after reload");

    console.log("=== VERIFIED (post-reload) Branch 0 condition value_template ===");
    console.log(verifyBranchTemplate);
    console.log();
    console.log("=== VERIFIED (post-reload) Tracker action if[0] value_template ===");
    console.log(verifyTrackerTemplate);
    console.log();

    console.log(JSON.stringify({
      automation: "patched",
      automationId,
      branchAlias: BRANCH_ALIAS,
      trackerAlias: TRACKER_ALIAS,
      occurrencesOfAndNotAwayBefore: 2,
      occurrencesOfAndNotAwayAfter: 0,
      hardAwaySetLineOccurrencesAfter: 2,
    }, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  patchTemplateText,
  findAutomationId,
  findBranch,
  findTrackerAction,
  alreadyApplied,
  findStringLeaves,
  diffStringLeaves,
  countOccurrences,
  AWAY_SET_LINE,
  HARD_AWAY_LINE,
  BRANCH_OLD_FINAL,
  BRANCH_NEW_FINAL,
  TRACKER_OLD_FINAL,
  TRACKER_NEW_FINAL,
  FRIENDLY_NAME,
  BRANCH_ALIAS,
  TRACKER_ALIAS,
};
