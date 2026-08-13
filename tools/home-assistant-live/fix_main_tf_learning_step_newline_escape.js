// Eval 016 - repair the double-escaped newlines the eval-015 backport wrote into
// the stratification learning step in main.tf.
//
// main.tf stores each Jinja template as ONE physical HCL line, in which a newline
// is the 2-character sequence \n. The backport lifted the primary_healthy preamble
// out of that already-escaped HCL text, so the string it held in memory contained a
// literal backslash followed by n. It then passed that through hclString(), which is
// JSON.stringify, and JSON.stringify escapes a literal backslash to \\. The five
// learning-step templates therefore landed in main.tf as \\n, which terraform parses
// as a literal backslash + n, not a newline.
//
// Live HA is correct and unaffected: the apply script POSTed real JSON with real
// newlines. Only main.tf is wrong - but a terraform apply from it would push the
// whole 85-line preamble to HA as a single line full of literal \n text, Jinja would
// fail to parse it, the learning step would error, and both stratification offsets
// would freeze.
//
// The 30 sensor-resolution chains are NOT affected: they were produced by string
// replacement inside already-escaped text and never went through hclString().
//
// Correctness here is not argued from counts. After patching, the five learning-step
// templates extracted from main.tf must be BYTE-IDENTICAL to the five running live,
// read back over the REST API - which is exactly the assertion eval 015 was missing.
//
// Run: HA_BASE=... HA_TOKEN=... node fix_main_tf_learning_step_newline_escape.js [--dry-run]

const fs = require("fs");
const path = require("path");
const { rest } = require("./ha_ws_util");

const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");
const AUTOMATION_ID = "1770077000021";
const RESOURCE = 'resource "homeassistant_automation" "test_aircon_bedroomb_room_sensor_comfort_band" {';
const LEARN_ALIAS = "Learn stratification offsets against the occupied-level room sensor";
const ALIAS_KEY = `"alias" = "${LEARN_ALIAS}"`;

const BAD = "\\\\n"; // two chars in the file: backslash backslash, then n
const GOOD = "\\n"; // one backslash, then n

// The file legitimately contains one \\n elsewhere: a Jinja join over a literal
// newline inside a nested-quoted string in the Lossnay battery-report automation.
const EXPECTED_LEGITIMATE_OUTSIDE = 1;

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// Extract every double-quoted HCL string literal, unescaping as terraform would.
function hclStrings(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] !== '"') { i += 1; continue; }
    let j = i + 1;
    let buf = "";
    while (j < src.length) {
      if (src[j] === "\\") {
        const n = src[j + 1];
        buf += n === "n" ? "\n" : n === "t" ? "\t" : n === '"' ? '"' : n === "\\" ? "\\" : "\\" + n;
        j += 2;
        continue;
      }
      if (src[j] === '"') break;
      buf += src[j];
      j += 1;
    }
    out.push(buf);
    i = j + 1;
  }
  return out;
}

function resourceBlock(tf) {
  const start = tf.indexOf(RESOURCE);
  if (start === -1) throw new Error("BedroomB resource not found in main.tf");
  const open = tf.indexOf("{", start);
  let depth = 0;
  let i = open;
  for (; i < tf.length; i += 1) {
    if (tf[i] === "{") depth += 1;
    else if (tf[i] === "}") { depth -= 1; if (depth === 0) break; }
  }
  return { open, close: i + 1, text: tf.slice(open, i + 1) };
}

function collectStrings(node, acc = []) {
  if (typeof node === "string") acc.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, acc));
  else if (node && typeof node === "object") Object.values(node).forEach((n) => collectStrings(n, acc));
  return acc;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const original = fs.readFileSync(MAIN_TF, "utf8");

  // The learning step spans from its own alias to the next alias key in the file.
  const start = original.indexOf(ALIAS_KEY);
  if (start === -1) throw new Error("learning-step alias not found in main.tf");
  const end = original.indexOf('"alias" = "', start + ALIAS_KEY.length);
  if (end === -1) throw new Error("no alias after the learning step - cannot bound its span");

  const before = original.slice(0, start);
  const span = original.slice(start, end);
  const after = original.slice(end);

  const inSpan = countOccurrences(span, BAD);
  const beforeCount = countOccurrences(before, BAD);
  const afterCount = countOccurrences(after, BAD);
  console.log(`double-escaped \\\\n: before=${beforeCount} inSpan=${inSpan} after=${afterCount}`);

  // C2 - nothing to fix outside the learning step.
  if (beforeCount !== 0) throw new Error(`refusing to write: ${beforeCount} double-escapes before the learning step`);
  if (afterCount !== EXPECTED_LEGITIMATE_OUTSIDE) {
    throw new Error(`refusing to write: expected ${EXPECTED_LEGITIMATE_OUTSIDE} legitimate double-escape after the span, found ${afterCount}`);
  }
  if (inSpan === 0) throw new Error("nothing to do: no double-escapes inside the learning step");

  // C1 - establish the defect against live before touching anything.
  const live = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
  const step = (live.actions || []).find((a) => a.alias === LEARN_ALIAS);
  if (!step) throw new Error("live automation has no learning step to compare against");
  const liveTemplates = collectStrings(step).filter((s) => s.length > 1000);
  if (liveTemplates.length !== 5) {
    throw new Error(`expected 5 long learning-step templates live, found ${liveTemplates.length}`);
  }
  const beforeStrings = new Set(hclStrings(resourceBlock(original).text));
  const missingBefore = liveTemplates.filter((s) => !beforeStrings.has(s)).length;
  console.log(`live learning-step templates absent from main.tf BEFORE the fix: ${missingBefore}/5 (the defect)`);
  if (missingBefore !== 5) {
    throw new Error("refusing to write: main.tf does not show the expected defect - re-diagnose before patching");
  }

  const patched = before + span.split(BAD).join(GOOD) + after;

  // C5 - only the span may move.
  if (patched.slice(0, start) !== before) throw new Error("refusing to write: text before the span changed");
  if (patched.slice(patched.length - after.length) !== after) throw new Error("refusing to write: text after the span changed");
  if (patched.length !== original.length - inSpan) {
    throw new Error(`refusing to write: length delta ${original.length - patched.length}, expected ${inSpan}`);
  }

  // C4 - the assertion eval 015 was missing: byte-identity against live.
  const afterStrings = new Set(hclStrings(resourceBlock(patched).text));
  const stillMissing = liveTemplates.filter((s) => !afterStrings.has(s));
  console.log(`live learning-step templates present in main.tf AFTER the fix: ${5 - stillMissing.length}/5`);
  if (stillMissing.length !== 0) {
    console.error(stillMissing.map((s) => `  MISSING (${s.length} chars): ${JSON.stringify(s.slice(0, 120))}`).join("\n"));
    throw new Error("refusing to write: patched main.tf still does not match live byte-for-byte");
  }

  // C6 - the eval-014 and eval-015 structural counts must not move.
  const markers = ["ac_temp_occupied", "secondary_room - secondary_stratification_offset",
    "((ac_temp - error) * 2) | round(0) / 2", "set boost_error", "(error | abs)", "conflict_worst_case"];
  const countsOf = (text) => Object.fromEntries(markers.map((m) => [m, countOccurrences(text, m)]));
  const wasCounts = countsOf(original);
  const nowCounts = countsOf(patched);
  console.log("structural markers before:", JSON.stringify(wasCounts));
  console.log("structural markers after :", JSON.stringify(nowCounts));
  if (JSON.stringify(wasCounts) !== JSON.stringify(nowCounts)) {
    throw new Error("refusing to write: structural marker counts changed");
  }

  if (dryRun) {
    console.log("\n--dry-run: all assertions passed, nothing written");
    return;
  }

  fs.writeFileSync(MAIN_TF, patched);
  console.log(`\nmain.tf written: ${inSpan} double-escaped newlines repaired inside the learning step`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
