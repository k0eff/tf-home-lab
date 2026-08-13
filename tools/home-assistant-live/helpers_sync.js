// Eval 017 - make the Home Assistant helper set declarative.
//
// Every tunable in the climate system (targets, deltas, thresholds, learned
// stratification offsets) is an input_number / input_boolean / input_select /
// input_text / input_datetime helper. NONE of them are in the repository:
// main.tf declares 98 homeassistant_automation resources and zero helpers,
// because the provider (Fabianoshz/homeassistant 0.2.3) has no input_number
// resource type at all - it offers only area, automation, device, entity and
// floor. There is also no terraform state for this stack, so it has never been
// applied.
//
// So the helpers exist purely as side effects of one-off scripts POSTing to the
// websocket API. Weeks of hand-tuning live only in HA's database: not
// reviewable, not diffable, not restorable. This tool makes that set a
// checked-in file with an idempotent applier.
//
//   node helpers_sync.js --export          live  -> helpers.json
//   node helpers_sync.js --check           diff  (exit 1 on any drift)
//   node helpers_sync.js --apply           print the plan, write nothing
//   node helpers_sync.js --apply --yes     helpers.json -> live
//
// Env: HA_BASE, HA_TOKEN.

const fs = require("fs");
const path = require("path");
const { connectWs, rest } = require("./ha_ws_util");

const SNAPSHOT = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "helpers.json");

// Domains whose helpers HA exposes through a <domain>/list websocket command.
// input_number carries real config (min/max/step) that matters for correctness;
// the others are listed so the snapshot is complete rather than number-only.
const DOMAINS = ["input_number", "input_boolean", "input_select", "input_text", "input_datetime"];

// Helpers whose VALUE is an output of the control loop, not a setting: the
// stratification learners re-write themselves every few minutes, and the
// last-seen mirrors track sensor readings. Their config is still declared and
// enforced, but --check does not call their value drift, and --apply does not
// force it - doing so would fight the learner and produce permanent phantom
// diffs. On a rebuild the recorded value still serves as the seed.
const RUNTIME_VALUE = /_stratification_offset$|_last_seen_value$/;

// Service names that share the input_* prefix and are NOT entities. Needed
// because "input_number.set_value" is indistinguishable from an entity id by
// shape alone.
const NOT_ENTITIES = new Set([
  "input_number.set_value", "input_number.increment", "input_number.decrement",
  "input_boolean.turn_on", "input_boolean.turn_off", "input_boolean.toggle",
  "input_select.select_option", "input_select.select_next", "input_select.select_previous",
  "input_text.set_value", "input_datetime.set_datetime",
]);

// Config keys per domain, in a fixed order so serialisation is deterministic.
const CONFIG_KEYS = {
  input_number: ["name", "icon", "min", "max", "step", "mode", "unit_of_measurement"],
  input_boolean: ["name", "icon"],
  input_select: ["name", "icon", "options"],
  input_text: ["name", "icon", "min", "max", "mode", "pattern"],
  input_datetime: ["name", "icon", "has_date", "has_time"],
};

let wsSeq = 100;

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  return out;
}

// Stable stringify: keys emitted in CONFIG_KEYS order, entities sorted by id.
// Without this a re-export reorders the file and every diff is noise.
//
// The on-disk shape is FLAT - config keys and "value" sit side by side on each
// helper - so that a hand edit is a one-line change. Live readings are nested
// ({config, value}) because that is what the websocket returns; diffHelper is
// the one place that bridges the two.
function serialise(snapshot) {
  const lines = ["{"];
  lines.push(`  "generated_by": ${JSON.stringify(snapshot.generated_by)},`);
  lines.push(`  "helper_count": ${snapshot.helper_count},`);
  lines.push('  "helpers": {');
  const ids = Object.keys(snapshot.helpers).sort();
  ids.forEach((id, i) => {
    const h = snapshot.helpers[id];
    const domain = id.split(".")[0];
    const cfg = pick(h, CONFIG_KEYS[domain] || Object.keys(h).filter((k) => k !== "value").sort());
    const body = Object.entries(cfg).map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    body.push(`      "value": ${JSON.stringify(h.value === undefined ? null : h.value)}`);
    lines.push(`    ${JSON.stringify(id)}: {`);
    lines.push(body.join(",\n"));
    lines.push(`    }${i === ids.length - 1 ? "" : ","}`);
  });
  lines.push("  }");
  lines.push("}");
  return lines.join("\n") + "\n";
}

async function readLive() {
  const ws = await connectWs();
  const states = await rest("/api/states", "GET");
  const stateOf = new Map(states.map((e) => [e.entity_id, e.state]));

  const helpers = {};
  try {
    for (const domain of DOMAINS) {
      const res = await ws.request({ id: ++wsSeq, type: `${domain}/list` });
      if (!res.success) throw new Error(`${domain}/list failed: ${JSON.stringify(res.error || res)}`);
      for (const item of res.result || []) {
        // HA derives the entity id from the helper's own id field.
        const entityId = `${domain}.${item.id}`;
        helpers[entityId] = {
          helper_id: item.id,
          config: pick(item, CONFIG_KEYS[domain]),
          value: stateOf.has(entityId) ? stateOf.get(entityId) : null,
        };
      }
    }
  } finally {
    ws.close();
  }
  return helpers;
}

function loadSnapshot() {
  if (!fs.existsSync(SNAPSHOT)) return null;
  return JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
}

// Compare one helper's declared config+value against live. Numbers are compared
// numerically: HA returns "24.4" for a value it stored as 24.4, and a string
// comparison would report permanent phantom drift on every numeric helper.
function diffHelper(id, want, got) {
  const domain = id.split(".")[0];
  const keys = CONFIG_KEYS[domain] || [];
  const problems = [];
  for (const k of keys) {
    const a = want[k];
    const b = got.config[k];
    if (a === undefined && b === undefined) continue;
    if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${k}: file=${JSON.stringify(a)} live=${JSON.stringify(b)}`);
  }
  if (!RUNTIME_VALUE.test(id)) {
    const wv = want.value;
    const gv = got.value;
    const bothNumeric = wv !== null && gv !== null && !isNaN(parseFloat(wv)) && !isNaN(parseFloat(gv));
    const valueDiffers = bothNumeric ? parseFloat(wv) !== parseFloat(gv) : String(wv) !== String(gv);
    if (valueDiffers) problems.push(`value: file=${JSON.stringify(wv)} live=${JSON.stringify(gv)}`);
  }
  return problems;
}

function compare(fileHelpers, live) {
  const fileIds = new Set(Object.keys(fileHelpers));
  const liveIds = new Set(Object.keys(live));
  const missingLive = [...fileIds].filter((id) => !liveIds.has(id)).sort();
  const extraLive = [...liveIds].filter((id) => !fileIds.has(id)).sort();
  const mismatched = [];
  for (const id of [...fileIds].filter((x) => liveIds.has(x)).sort()) {
    const problems = diffHelper(id, fileHelpers[id], live[id]);
    if (problems.length) mismatched.push({ id, problems });
  }
  return { missingLive, extraLive, mismatched };
}

async function cmdExport() {
  const live = await readLive();
  const count = Object.keys(live).length;
  if (count === 0) throw new Error("refusing to write: live helper set is empty");

  const existing = loadSnapshot();
  if (existing && count < existing.helper_count * 0.9) {
    throw new Error(`refusing to write: live count ${count} collapsed versus snapshot ${existing.helper_count}`);
  }

  const snapshot = {
    generated_by: "tools/home-assistant-live/helpers_sync.js --export",
    helper_count: count,
    helpers: Object.fromEntries(Object.entries(live).map(([id, h]) => [id, { ...h.config, value: h.value }])),
  };
  const text = serialise(snapshot);

  // C7 - the file must round-trip, or --check will report phantom drift forever.
  if (serialise(JSON.parse(text)) !== text) throw new Error("refusing to write: snapshot does not round-trip");

  fs.writeFileSync(SNAPSHOT, text);
  console.log(`exported ${count} helpers -> ${path.relative(process.cwd(), SNAPSHOT)}`);
  return 0;
}

async function cmdCheck() {
  const snap = loadSnapshot();
  if (!snap) throw new Error(`no snapshot at ${SNAPSHOT} - run --export first`);
  const live = await readLive();
  const { missingLive, extraLive, mismatched } = compare(snap.helpers, live);

  console.log(`snapshot: ${Object.keys(snap.helpers).length} helpers | live: ${Object.keys(live).length}`);
  if (missingLive.length) {
    console.log(`\nDECLARED BUT MISSING LIVE (${missingLive.length}) - --apply would create these:`);
    missingLive.forEach((id) => console.log(`  ${id}`));
  }
  if (extraLive.length) {
    console.log(`\nLIVE BUT NOT DECLARED (${extraLive.length}) - created outside the repo, re-run --export to adopt:`);
    extraLive.forEach((id) => console.log(`  ${id} = ${live[id].value}`));
  }
  if (mismatched.length) {
    console.log(`\nDRIFTED (${mismatched.length}):`);
    mismatched.forEach(({ id, problems }) => console.log(`  ${id}\n      ${problems.join("\n      ")}`));
  }
  const total = missingLive.length + extraLive.length + mismatched.length;
  console.log(total === 0 ? "\nno drift" : `\n${total} difference(s)`);
  return total === 0 ? 0 : 1;
}

async function cmdApply(write) {
  const snap = loadSnapshot();
  if (!snap) throw new Error(`no snapshot at ${SNAPSHOT} - run --export first`);
  const live = await readLive();
  const { missingLive, mismatched } = compare(snap.helpers, live);

  const plan = [];
  for (const id of missingLive) plan.push({ action: "create", id, want: snap.helpers[id] });
  for (const { id, problems } of mismatched) plan.push({ action: "update", id, want: snap.helpers[id], problems });

  if (plan.length === 0) { console.log("nothing to do - live already matches the snapshot"); return 0; }
  console.log(`plan (${plan.length}):`);
  plan.forEach((p) => console.log(`  ${p.action.padEnd(6)} ${p.id}${p.problems ? `  [${p.problems.join("; ")}]` : ""}`));

  if (!write) { console.log("\n--apply without --yes: nothing written"); return 0; }

  const ws = await connectWs();
  try {
    for (const p of plan) {
      const domain = p.id.split(".")[0];
      const helperId = p.id.slice(domain.length + 1);
      const cfg = pick(p.want, CONFIG_KEYS[domain]);
      if (p.action === "create") {
        const res = await ws.request({ ...cfg, id: ++wsSeq, type: `${domain}/create` });
        if (!res.success) throw new Error(`create ${p.id} failed: ${JSON.stringify(res.error || res)}`);
      } else {
        const res = await ws.request({ ...cfg, id: ++wsSeq, type: `${domain}/update`, [`${domain}_id`]: helperId });
        if (!res.success) throw new Error(`update ${p.id} failed: ${JSON.stringify(res.error || res)}`);
      }
      // Runtime values are seeded on creation only; never forced on an existing
      // helper, or every --apply would stamp on what the learner has converged to.
      const seedOnly = RUNTIME_VALUE.test(p.id) && p.action !== "create";
      if (!seedOnly && p.want.value !== null && p.want.value !== undefined) {
        if (domain === "input_number") {
          await rest("/api/services/input_number/set_value", "POST", { entity_id: p.id, value: parseFloat(p.want.value) });
        } else if (domain === "input_boolean") {
          await rest(`/api/services/input_boolean/turn_${p.want.value === "on" ? "on" : "off"}`, "POST", { entity_id: p.id });
        } else if (domain === "input_select") {
          await rest("/api/services/input_select/select_option", "POST", { entity_id: p.id, option: p.want.value });
        } else if (domain === "input_text") {
          await rest("/api/services/input_text/set_value", "POST", { entity_id: p.id, value: p.want.value });
        }
      }
      console.log(`  ${p.action}d ${p.id}`);
    }
  } finally {
    ws.close();
  }
  console.log(`\napplied ${plan.length} change(s) - re-run --check to confirm convergence`);
  return 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes("--yes");
  let rc;
  if (argv.includes("--export")) rc = await cmdExport();
  else if (argv.includes("--check")) rc = await cmdCheck();
  else if (argv.includes("--apply")) rc = await cmdApply(write);
  else {
    console.log("usage: helpers_sync.js --export | --check | --apply [--yes]");
    rc = 2;
  }
  process.exit(rc);
}

// Exported so the validator asserts against the same definitions the tool uses,
// rather than a second copy that could drift from it.
module.exports = { RUNTIME_VALUE, NOT_ENTITIES, serialise };

if (require.main === module) {
  main().catch((err) => { console.error(err.message || err); process.exit(1); });
}
