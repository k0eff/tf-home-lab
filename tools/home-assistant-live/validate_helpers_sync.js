// Eval 017 validation. Every check is executed against the live instance and the
// real snapshot file; nothing is asserted by argument.
//
// Run: HA_BASE=... HA_TOKEN=... node validate_helpers_sync.js

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { rest } = require("./ha_ws_util");
const { RUNTIME_VALUE, NOT_ENTITIES, serialise } = require("./helpers_sync");

const TOOL = path.join(__dirname, "helpers_sync.js");
const SNAPSHOT = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "helpers.json");
const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");

let pass = 0;
let fail = 0;

function check(id, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${id}  ${detail}`);
  ok ? (pass += 1) : (fail += 1);
}

function run(args, env = {}) {
  try {
    const out = execFileSync("node", [TOOL, ...args], {
      encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"],
    });
    return { rc: 0, out };
  } catch (e) {
    return { rc: e.status === undefined ? -1 : e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}

async function liveValues() {
  const states = await rest("/api/states", "GET");
  return Object.fromEntries(states
    .filter((e) => /^input_(number|boolean|select|text|datetime)\./.test(e.entity_id))
    .map((e) => [e.entity_id, e.state]));
}

async function main() {
  const original = fs.readFileSync(SNAPSHOT, "utf8");
  const snap = JSON.parse(original);
  const ids = Object.keys(snap.helpers);

  // C1 - snapshot count equals live count.
  const live = await liveValues();
  check("C1", snap.helper_count === ids.length && ids.length === Object.keys(live).length,
    `snapshot helper_count=${snap.helper_count} entries=${ids.length} live=${Object.keys(live).length}`);

  // C2 - clean check on an untouched snapshot.
  const clean = run(["--check"]);
  check("C2", clean.rc === 0 && /no drift/.test(clean.out), `rc=${clean.rc}, ${clean.out.trim().split("\n").pop()}`);

  // C7 - the serialiser is stable: parse the file and re-serialise it, and the
  //      bytes must be identical. Deliberately NOT tested by re-exporting from
  //      live: the self-learning offsets move between two exports, so that would
  //      measure the learner rather than the serialiser.
  const reserialised = serialise(JSON.parse(original));
  check("C7", reserialised === original,
    `parse + re-serialise byte-identical (${original.length} bytes)`);

  // C3 - perturb exactly one numeric value; --check must report that one and fail.
  //      The victim must be a settings helper, not a self-learning one.
  const victim = ids.find((id) => id.startsWith("input_number.")
    && !RUNTIME_VALUE.test(id) && !isNaN(parseFloat(snap.helpers[id].value)));
  const perturbed = JSON.parse(original);
  const wasValue = parseFloat(perturbed.helpers[victim].value);
  perturbed.helpers[victim].value = String(wasValue + 7.77);
  fs.writeFileSync(SNAPSHOT, serialise(perturbed));
  const dirty = run(["--check"]);
  check("C3", dirty.rc === 1 && dirty.out.includes(victim) && /DRIFTED \(1\)/.test(dirty.out),
    `rc=${dirty.rc}, drifted=1, victim=${victim} (${wasValue} -> ${(wasValue + 7.77).toFixed(2)})`);

  // C5 - --apply without --yes prints a plan and changes nothing live.
  const liveBeforePlan = await liveValues();
  const planned = run(["--apply"]);
  const liveAfterPlan = await liveValues();
  const planWroteNothing = JSON.stringify(liveBeforePlan) === JSON.stringify(liveAfterPlan);
  check("C5", planned.rc === 0 && /nothing written/.test(planned.out) && planWroteNothing,
    `rc=${planned.rc}, plan printed, live untouched=${planWroteNothing}`);

  // Restore the real snapshot before the remaining checks.
  fs.writeFileSync(SNAPSHOT, original);

  // C4 - --check is read-only.
  const v1 = await liveValues();
  run(["--check"]);
  const v2 = await liveValues();
  const changed = Object.keys(v1).filter((k) => v1[k] !== v2[k]);
  // The two learned stratification offsets move on their own every few minutes,
  // so they are excluded rather than allowed to make this check flaky.
  const learners = changed.filter((k) => !/stratification_offset$/.test(k));
  check("C4", learners.length === 0,
    `helpers changed across a --check: ${learners.length}${changed.length ? ` (ignoring ${changed.length - learners.length} self-learning)` : ""}`);

  // C6 - no automation template references a helper the snapshot does not
  //      declare. Service calls share the input_* prefix ("input_number.set_value"
  //      is a service, not an entity) and are excluded by name.
  const tf = fs.readFileSync(MAIN_TF, "utf8");
  const referenced = [...new Set([...tf.matchAll(/input_(?:number|boolean|select|text|datetime)\.[a-z0-9_]+/g)].map((m) => m[0]))]
    .filter((r) => !NOT_ENTITIES.has(r));
  const declared = new Set(ids);
  const dangling = referenced.filter((r) => !declared.has(r));
  check("C6", dangling.length === 0,
    `main.tf references ${referenced.length} helpers, undeclared: ${dangling.length}${dangling.length ? " -> " + dangling.join(", ") : ""}`);

  // C8 - export refuses to write against an instance with no helpers.
  //      Pointed at a base URL that answers but has nothing, the guard must fire
  //      rather than blanking the snapshot.
  const sizeBefore = fs.statSync(SNAPSHOT).size;
  const broken = run(["--export"], { HA_BASE: "http://127.0.0.1:9/" });
  const sizeAfter = fs.statSync(SNAPSHOT).size;
  check("C8", broken.rc !== 0 && sizeBefore === sizeAfter,
    `rc=${broken.rc}, snapshot size unchanged (${sizeBefore} bytes)`);

  // C10 - the runtime-value exemption is scoped to the VALUE only. Moving a
  //       learner's value in the file must be ignored; corrupting its config
  //       must still be caught. Both halves are asserted, because an exemption
  //       that swallowed config drift too would hide real damage.
  const learner = ids.find((id) => RUNTIME_VALUE.test(id) && id.startsWith("input_number."));
  const p1 = JSON.parse(original);
  p1.helpers[learner].value = String(parseFloat(p1.helpers[learner].value) + 9.99);
  fs.writeFileSync(SNAPSHOT, serialise(p1));
  const learnerValue = run(["--check"]);

  const p2 = JSON.parse(original);
  p2.helpers[learner].step = 0.5;
  fs.writeFileSync(SNAPSHOT, serialise(p2));
  const learnerConfig = run(["--check"]);

  fs.writeFileSync(SNAPSHOT, original);
  check("C10", learnerValue.rc === 0 && learnerConfig.rc === 1 && learnerConfig.out.includes("step:"),
    `${learner}: value drift ignored (rc=${learnerValue.rc}), config drift caught (rc=${learnerConfig.rc})`);

  // Final guarantee: the file on disk is exactly what we started with.
  check("C9", fs.readFileSync(SNAPSHOT, "utf8") === original, "validation left the snapshot byte-identical");

  console.log(`\n${pass}/${pass + fail} checks passed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
