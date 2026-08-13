// Executable validation for the logic-invariant evals 018-029.
//
//   node validate_logic.js --eval 018        run one suite
//   node validate_logic.js --all             run every suite
//   node validate_logic.js --all --json      machine-readable summary
//
// Every suite asserts a property of the CURRENT control logic against the live
// instance. Nothing here is asserted by argument: if a check cannot be measured
// it is reported as an error rather than quietly passing.
//
// Env: HA_BASE, HA_TOKEN (see tools/home-assistant-live/README.md).

const fs = require("fs");
const M = require("./logic_model");
const { rest } = require("./ha_ws_util");

// ------------------------------------------------------------------ context

const ctx = { _cache: {} };

function repo() {
  if (!ctx._cache.repo) ctx._cache.repo = M.loadRepo();
  return ctx._cache.repo;
}

async function states() {
  if (!ctx._cache.states) {
    const list = await M.fetchStates();
    ctx._cache.states = new Map(list.map((e) => [e.entity_id, e]));
  }
  return ctx._cache.states;
}

// Live automation configs, keyed by the HA id from import.tf.
async function liveConfigs() {
  if (ctx._cache.live) return ctx._cache.live;
  const r = repo();
  const out = new Map();
  const entries = [...r.idByName.entries()];
  const POOL = 8;
  let i = 0;
  await Promise.all(Array.from({ length: POOL }, async () => {
    while (i < entries.length) {
      const [name, id] = entries[i++];
      out.set(name, { id, cfg: await M.fetchLiveAutomation(id) });
    }
  }));
  ctx._cache.live = out;
  return out;
}

// Real service names, taken from the instance rather than a hardcoded list, so
// that "climate.set_temperature" is not mistaken for a missing entity.
async function serviceNames() {
  if (ctx._cache.services) return ctx._cache.services;
  const svc = await rest("/api/services", "GET");
  const set = new Set();
  for (const d of svc) for (const s of Object.keys(d.services || {})) set.add(`${d.domain}.${s}`);
  ctx._cache.services = set;
  return set;
}

async function renderPool(templates, poolSize = 6) {
  const results = new Array(templates.length);
  let i = 0;
  await Promise.all(Array.from({ length: poolSize }, async () => {
    while (i < templates.length) {
      const idx = i++;
      results[idx] = await M.renderTemplate(templates[idx]);
    }
  }));
  return results;
}

// ------------------------------------------------------------------ helpers

const ROOMS = [
  { prefix: "bedroomb", resource: "test_aircon_bedroomb_room_sensor_comfort_band" },
  { prefix: "bedrooms", resource: "test_aircon_bedrooms_room_sensor_comfort_band" },
  { prefix: "livingr", resource: "test_aircon_livingr_room_sensor_comfort_band" },
];

function allFieldText(res) {
  return ["trigger", "condition", "action"].map((f) => res.fields[f] || "").join("\n");
}

// The climate entity a room controls is read out of the automation rather than
// hardcoded here. A hardcoded id that drifts turns a real check into "entity
// absent live", which looks like a finding and is not one.
function climateOf(res, svc) {
  const ents = M.entitiesIn(allFieldText(res)).filter((e) => e.startsWith("climate.") && !svc.has(e));
  return ents.length === 1 ? ents[0] : (ents[0] || null);
}

// Live enabled/disabled state per resource name, via import.tf's id mapping.
async function liveMeta() {
  if (ctx._cache.meta) return ctx._cache.meta;
  const r = repo();
  const st = await states();
  const byId = new Map([...st.values()]
    .filter((e) => e.entity_id.startsWith("automation.") && e.attributes.id)
    .map((e) => [String(e.attributes.id), e]));
  const live = await liveConfigs();
  const meta = new Map();
  for (const res of r.resources) {
    const id = r.idByName.get(res.name);
    const ent = byId.get(String(id));
    const cfg = (live.get(res.name) || {}).cfg;
    meta.set(res.name, {
      id,
      enabled: ent ? ent.state === "on" : false,
      // The alias must come from the instance: 39 automations were renamed live
      // with an [OLD] prefix that main.tf never received, so generation read
      // from the repo is wrong for exactly the automations that matter.
      liveAlias: (cfg && !cfg.__error && cfg.alias) || (ent && ent.attributes.friendly_name) || "",
    });
  }
  ctx._cache.meta = meta;
  return meta;
}

function check(list, id, ok, detail) { list.push({ id, ok: !!ok, detail }); }

// -------------------------------------------------------------------- suites

const SUITES = {};

// 018 - the repository and the instance must describe the same automations.
SUITES["018"] = {
  title: "code<->live parity for every managed automation",
  async run() {
    const c = [];
    const r = repo();
    const live = await liveConfigs();

    const missingId = r.resources.filter((x) => !r.idByName.has(x.name));
    check(c, "C1", missingId.length === 0, `resources without an import id: ${missingId.length}`);

    const unreachable = [...live.entries()].filter(([, v]) => !v.cfg || v.cfg.__error);
    check(c, "C2", unreachable.length === 0,
      `import ids that do not resolve live: ${unreachable.length}${unreachable.length ? " -> " + unreachable.slice(0, 3).map(([n]) => n).join(", ") : ""}`);

    const cmp = { alias: [], mode: [], trigger: [], condition: [], action: [] };
    let identical = 0;
    for (const res of r.resources) {
      const l = live.get(res.name);
      if (!l || !l.cfg || l.cfg.__error) continue;
      const a = M.repoConfig(res);
      const b = M.normaliseConfig(l.cfg);
      let same = true;
      for (const k of ["alias", "mode", "trigger", "condition", "action"]) {
        if (M.canonical(a[k]) !== M.canonical(b[k])) { cmp[k].push(res.name); same = false; }
      }
      if (same) identical += 1;
    }
    check(c, "C3", cmp.alias.length === 0, `alias mismatches: ${cmp.alias.length}`);
    check(c, "C4", cmp.mode.length === 0, `mode mismatches: ${cmp.mode.length}`);
    check(c, "C5", cmp.trigger.length === 0, `trigger mismatches: ${cmp.trigger.length}${cmp.trigger.length ? " -> " + cmp.trigger.slice(0, 5).join(", ") : ""}`);
    check(c, "C6", cmp.condition.length === 0, `condition mismatches: ${cmp.condition.length}${cmp.condition.length ? " -> " + cmp.condition.slice(0, 5).join(", ") : ""}`);
    check(c, "C7", cmp.action.length === 0, `action mismatches: ${cmp.action.length}${cmp.action.length ? " -> " + cmp.action.slice(0, 5).join(", ") : ""}`);
    check(c, "C8", identical === r.resources.length,
      `fully identical resources: ${identical}/${r.resources.length}`);
    return c;
  },
};

// 019 - import.tf is the only bridge between resource names and HA ids; if it
//       is not a clean bijection, terraform apply targets the wrong automation.
SUITES["019"] = {
  title: "import.tf is a clean bijection onto live automations",
  async run() {
    const c = [];
    const r = repo();
    const st = await states();

    check(c, "C1", r.imports.length === r.resources.length,
      `import blocks ${r.imports.length} vs resources ${r.resources.length}`);

    const dupRes = dupes(r.resources.map((x) => x.name));
    check(c, "C2", dupRes.length === 0, `duplicate resource names: ${dupRes.length}${dupRes.length ? " -> " + dupRes.join(", ") : ""}`);

    const dupId = dupes(r.imports.map((x) => x.id));
    check(c, "C3", dupId.length === 0, `duplicate import ids: ${dupId.length}${dupId.length ? " -> " + dupId.join(", ") : ""}`);

    const names = new Set(r.resources.map((x) => x.name));
    const dangling = r.imports.filter((x) => !names.has(x.name));
    check(c, "C4", dangling.length === 0, `import blocks pointing at no resource: ${dangling.length}`);

    // Coverage the other way: live automations that no resource claims.
    const managed = new Set(r.imports.map((x) => x.id));
    const liveAutos = [...st.values()].filter((e) => e.entity_id.startsWith("automation.") && e.attributes.id);
    const unmanaged = liveAutos.filter((e) => !managed.has(String(e.attributes.id)));
    const unmanagedEnabled = unmanaged.filter((e) => e.state === "on");
    check(c, "C5", unmanaged.length === 0,
      `live automations absent from import.tf: ${unmanaged.length} (${unmanagedEnabled.length} of them enabled)`);
    check(c, "C6", unmanagedEnabled.length === 0,
      `ENABLED live automations not under terraform: ${unmanagedEnabled.length}${unmanagedEnabled.length ? " -> " + unmanagedEnabled.slice(0, 5).map((e) => e.attributes.friendly_name || e.entity_id).join(" | ") : ""}`);
    return c;
  },
};

// 020 - the escaping layer that eval 016 found corrupted. A double-escaped \n
//       turns a multi-line Jinja program into one comment line and every
//       presence check still passes, so this asserts bytes, not presence.
SUITES["020"] = {
  title: "HCL string escaping is lossless and free of double-escapes",
  async run() {
    const c = [];
    const r = repo();

    const dbl = [];
    for (const res of r.resources) {
      for (const [f, raw] of Object.entries(res.raw)) {
        if (res.style[f] !== "string") continue;
        if (/\\\\n/.test(raw)) dbl.push(`${res.name}.${f}`);
      }
    }
    check(c, "C1", dbl.length === 0, `string-style fields containing a double-escaped \\\\n: ${dbl.length}`);

    let rt = 0; const rtBad = [];
    for (const res of r.resources) {
      for (const [f, raw] of Object.entries(res.raw)) {
        if (res.style[f] !== "string") continue;
        if (M.hclEscape(M.hclUnescape(raw)) === raw) rt += 1; else rtBad.push(`${res.name}.${f}`);
      }
    }
    check(c, "C2", rtBad.length === 0, `escape round-trip: ${rt} ok, ${rtBad.length} lossy`);

    const badJson = [];
    for (const res of r.resources) {
      for (const f of ["trigger", "condition", "action"]) {
        if (!res.style[f]) continue;
        try { JSON.parse(res.fields[f]); } catch (e) { badJson.push(`${res.name}.${f}`); }
      }
    }
    check(c, "C3", badJson.length === 0, `fields that do not parse as JSON: ${badJson.length}`);

    // The eval-016 corruption signature, stated precisely. A literal two-char
    // backslash-n is legitimate inside a Jinja string expression - join("\n")
    // is correct and common - so its mere presence proves nothing. What cannot
    // be legitimate is a multi-statement Jinja program that has NO real newline
    // at all: that is a whole program collapsed onto one line, where every
    // statement after the first is dead.
    const litNl = [];
    for (const res of r.resources) {
      for (const t of M.templatesIn(res)) {
        const stmts = (t.tpl.match(/\{%|\{\{/g) || []).length;
        if (t.tpl.includes("\\n") && !t.tpl.includes("\n") && stmts >= 2) {
          litNl.push(`${res.name}.${t.field}.${t.path} (${stmts} statements, 0 real newlines)`);
        }
      }
    }
    check(c, "C4", litNl.length === 0,
      `multi-statement templates collapsed onto one line by a double-escape: ${litNl.length}${litNl.length ? " -> " + litNl.slice(0, 3).join(", ") : ""}`);

    // Multi-line templates must actually be multi-line.
    const tpls = r.resources.flatMap((res) => M.templatesIn(res));
    const multi = tpls.filter((t) => t.tpl.includes("\n")).length;
    check(c, "C5", multi > 0, `templates with real newlines: ${multi}/${tpls.length}`);
    return c;
  },
};

// 021 - a template that reads a non-existent entity does not error; it silently
//       yields 'unknown' and the control loop falls back. Silent is the problem.
SUITES["021"] = {
  title: "every entity referenced by the automations exists live",
  async run() {
    const c = [];
    const r = repo();
    const st = await states();
    const svc = await serviceNames();

    // Scoped to ENABLED automations. A disabled [OLD] automation pointing at a
    // decommissioned entity is dead code, not a live defect, and folding the
    // two together buries the second inside the first.
    const meta = await liveMeta();
    const refsEnabled = new Set();
    const refsDisabled = new Set();
    for (const res of r.resources) {
      const m = meta.get(res.name);
      const target = m && m.enabled ? refsEnabled : refsDisabled;
      M.entitiesIn(allFieldText(res)).forEach((e) => target.add(e));
    }
    const candidates = [...refsEnabled].filter((e) => !svc.has(e));
    const missing = candidates.filter((e) => !st.has(e));
    check(c, "C1", missing.length === 0,
      `entities referenced by ENABLED automations: ${candidates.length}, missing live: ${missing.length}${missing.length ? " -> " + missing.slice(0, 8).join(", ") : ""}`);

    const deadInDisabled = [...refsDisabled].filter((e) => !svc.has(e) && !st.has(e) && !refsEnabled.has(e));
    check(c, "C2", deadInDisabled.length === 0,
      `entities referenced only by DISABLED automations and absent live: ${deadInDisabled.length}${deadInDisabled.length ? " -> " + deadInDisabled.slice(0, 8).join(", ") : ""}`);

    // A dead climate entity silently disables a whole room.
    const climates = candidates.filter((e) => e.startsWith("climate."));
    const deadClimate = climates.filter((e) => !st.has(e) || st.get(e).state === "unavailable");
    check(c, "C3", climates.length > 0 && deadClimate.length === 0,
      `climate entities commanded by enabled automations: ${climates.length}, dead: ${deadClimate.length}${deadClimate.length ? " -> " + deadClimate.join(", ") : ""}`);

    // Temperature sensors are the loop's only input; one that goes unavailable
    // changes behaviour immediately.
    const sensors = candidates.filter((e) => /^sensor\..*_temperature$/.test(e) && st.has(e));
    const badSensors = sensors.filter((e) => ["unavailable", "unknown"].includes(st.get(e).state));
    check(c, "C4", badSensors.length === 0,
      `temperature sensors feeding enabled loops: ${sensors.length}, unavailable/unknown: ${badSensors.length}${badSensors.length ? " -> " + badSensors.join(", ") : ""}`);
    return c;
  },
};

// 022 - a Jinja error inside a condition makes the condition false, which
//       disables a branch permanently and silently.
SUITES["022"] = {
  title: "every embedded Jinja template compiles and renders live",
  async run() {
    const c = [];
    const r = repo();
    const discovered = [];
    for (const res of r.resources) for (const t of M.templatesIn(res)) discovered.push({ res: res.name, ...t });

    // /api/template renders with no automation run context, so a template that
    // reads trigger/this/repeat/wait cannot render standalone and would fail
    // for a reason that has nothing to do with its correctness. Those are
    // reported as skipped rather than counted as failures.
    const NEEDS_CTX = /\b(trigger|this|repeat|wait)\s*\./;
    const all = discovered.filter((t) => !NEEDS_CTX.test(t.tpl));
    const skipped = discovered.length - all.length;
    check(c, "C1", all.length > 0,
      `templates discovered: ${discovered.length}, renderable standalone: ${all.length}, needing run context: ${skipped}`);

    const results = await renderPool(all.map((t) => t.tpl));
    const failed = [];
    results.forEach((x, i) => { if (x.status !== 200) failed.push({ ...all[i], status: x.status, body: String(x.body).slice(0, 140) }); });
    check(c, "C2", failed.length === 0,
      `templates failing to render: ${failed.length}/${all.length}${failed.length ? " -> " + failed.slice(0, 3).map((f) => `${f.res}.${f.field} [${f.status}] ${f.body}`).join(" || ") : ""}`);

    // A condition template that does not render to a boolean is a condition
    // that never means what it looks like it means. HA prints Python booleans
    // (True/False); a template that yields a lowercase JSON-style literal is
    // still boolean-valued to HA, so both spellings are accepted.
    const condIdx = all.map((t, i) => (t.field === "condition" && t.path.endsWith("value_template") ? i : -1)).filter((i) => i >= 0);
    const nonBool = condIdx.filter((i) => results[i].status === 200
      && !["true", "false"].includes(String(results[i].body).trim().toLowerCase()));
    check(c, "C3", nonBool.length === 0,
      `top-level condition templates not rendering to a boolean: ${nonBool.length}/${condIdx.length}`
      + (nonBool.length ? " -> " + nonBool.slice(0, 3).map((i) => `${all[i].res}: ${String(results[i].body).slice(0, 60)}`).join(" || ") : ""));
    return c;
  },
};

// 023 - branches are selected by trigger.id. A reference to an id that no
//       trigger defines is a branch that can never run.
SUITES["023"] = {
  title: "every trigger.id referenced by a branch is actually defined",
  async run() {
    const c = [];
    const r = repo();
    let totalRefs = 0;
    const dangling = [];
    const dupIds = [];
    let totalTriggers = 0;

    for (const res of r.resources) {
      const trg = asArr(M.safeJson(res.fields.trigger) || []);
      totalTriggers += trg.length;
      const idList = trg.map((t) => t && t.id).filter(Boolean);
      const defined = new Set(idList);
      for (const d of dupes(idList)) dupIds.push(`${res.name}: '${d}'`);
      const text = allFieldText(res);
      const refs = new Set();
      for (const m of text.matchAll(/trigger\.id\s*(?:==|!=)\s*'([^']+)'/g)) refs.add(m[1]);
      for (const m of text.matchAll(/trigger\.id\s+in\s+\[([^\]]*)\]/g)) {
        for (const s of m[1].matchAll(/'([^']+)'/g)) refs.add(s[1]);
      }
      totalRefs += refs.size;
      for (const ref of refs) if (!defined.has(ref)) dangling.push(`${res.name}: '${ref}'`);
    }
    check(c, "C1", totalRefs > 0, `trigger.id references found: ${totalRefs} across ${totalTriggers} triggers`);
    check(c, "C2", dangling.length === 0,
      `branches keyed on an undefined trigger id: ${dangling.length}${dangling.length ? " -> " + dangling.slice(0, 5).join(", ") : ""}`);
    // A repeated id makes branch selection ambiguous: two different triggers
    // then select the same branch and neither can be distinguished in a trace.
    // Triggers with no id reference are NOT flagged - re-evaluating the whole
    // decision on any input change is the intended design of these loops.
    check(c, "C3", dupIds.length === 0,
      `duplicate trigger ids within one automation: ${dupIds.length}${dupIds.length ? " -> " + dupIds.slice(0, 5).join(", ") : ""}`);
    return c;
  },
};

// 024 - the BedroomS night contract the user states as intended: fix the
//       temperature, disengage the program, let the AC hold it.
SUITES["024"] = {
  title: "BedroomS night fixed-cooling disengages the program and pins the setpoint",
  async run() {
    const c = [];
    const r = repo();
    const st = await states();
    const res = r.byName.get("test_aircon_bedrooms_room_sensor_comfort_band");
    if (!res) { check(c, "C0", false, "comfort-band resource not found in main.tf"); return c; }
    const text = allFieldText(res);

    const GATE = "not (summer_night_window and is_state('input_boolean.bedrooms_night_fixed_cooling', 'on') and not away)";
    const gateCount = text.split(GATE).length - 1;
    check(c, "C1", gateCount >= 3, `suppression guard present on ${gateCount} proportional branches (expected >= 3)`);

    const setsFromHelper = /"temperature":\s*"\{\{\s*states\('input_number\.bedrooms_night_fixed_cooling_target'\)/.test(text)
      || text.includes("states('input_number.bedrooms_night_fixed_cooling_target')");
    check(c, "C2", setsFromHelper, "fixed branch reads night_fixed_cooling_target rather than a literal");

    const trg = M.safeJson(res.fields.trigger) || [];
    const ids = new Set(asArr(trg).map((t) => t && t.id));
    check(c, "C3", ids.has("summer_night_fixed_cooling_start") && ids.has("night_fixed_cooling_toggle_on"),
      "both entry triggers defined (19:30 clock + toggle turning on)");

    const toggle = st.get("input_boolean.bedrooms_night_fixed_cooling");
    const target = st.get("input_number.bedrooms_night_fixed_cooling_target");
    check(c, "C4", !!toggle && !!target, `helpers live: toggle=${toggle && toggle.state}, target=${target && target.state}`);

    // The behavioural assertion: inside the night window the setpoint must be
    // written once at handover and never again. Measured over 4 nights.
    const now = new Date();
    const start = new Date(now - 4 * 24 * 3600 * 1000).toISOString();
    const hist = await rest(`/api/history/period/${start}?end_time=${encodeURIComponent(now.toISOString())}`
      + `&filter_entity_id=climate.v537_spalniam_2`, "GET");
    const pts = (hist[0] || []).map((p) => ({
      t: new Date(p.last_changed || p.last_updated),
      sp: p.attributes && p.attributes.temperature,
    })).filter((p) => p.sp !== undefined);
    const inNight = (d) => { const h = d.getHours(), m = d.getMinutes(); return (h > 19 || (h === 19 && m >= 30)) || h < 9; };
    // Changes are computed on the UNFILTERED series, then labelled - filtering
    // first makes each window boundary look like a write.
    const changes = pts.filter((p, i) => i > 0 && p.sp !== pts[i - 1].sp);
    // Allow the handover itself: a change within 120s of the 19:30 boundary.
    const nightWrites = changes.filter((p) => inNight(p.t)
      && !(p.t.getHours() === 19 && p.t.getMinutes() >= 30 && p.t.getMinutes() < 32));
    check(c, "C5", nightWrites.length === 0,
      `setpoint writes inside the night window excluding the 19:30 handover: ${nightWrites.length}`
      + (nightWrites.length ? " -> " + nightWrites.slice(0, 5).map((p) => `${p.t.toTimeString().slice(0, 8)}=${p.sp}`).join(", ") : ""));

    const fixed = target ? parseFloat(target.state) : NaN;
    const handover = changes.filter((p) => p.t.getHours() === 19 && p.t.getMinutes() >= 30 && p.t.getMinutes() < 32);
    const wrongHandover = handover.filter((p) => Math.abs(parseFloat(p.sp) - fixed) > 0.01);
    check(c, "C6", handover.length > 0 && wrongHandover.length === 0,
      `19:30 handovers observed: ${handover.length}, landing on a value other than ${fixed}: ${wrongHandover.length}`);
    return c;
  },
};

// 025 - eval 015 normalised the control reference frame so the loop reasons
//       about the occupied level rather than whatever the AC's own probe reads.
//       This asserts every room got it, not just the one that was fixed.
SUITES["025"] = {
  title: "all three rooms control on the normalised (occupied-level) frame",
  async run() {
    const c = [];
    const r = repo();
    const st = await states();
    for (const room of ROOMS) {
      const res = r.byName.get(room.resource);
      if (!res) { check(c, `C-${room.prefix}`, false, `${room.resource} not found in main.tf`); continue; }
      const text = allFieldText(res);
      // Helper names are matched by pattern, not guessed: the one room that has
      // this calls it bedroomb_ac_stratification_offset, and a hardcoded guess
      // would have reported the room that HAS the fix as missing it.
      const offsetRe = new RegExp(`input_number\\.${room.prefix}_[a-z0-9_]*stratification_offset`);
      const helperLive = [...st.keys()].filter((k) => offsetRe.test(k));
      const usesOccupied = text.includes("ac_temp_occupied");
      const usesOffset = offsetRe.test(text);
      check(c, `C-${room.prefix}`, usesOccupied && usesOffset && helperLive.length > 0,
        `${room.prefix}: ac_temp_occupied=${usesOccupied}, offset helper referenced=${usesOffset}, helper live=${helperLive.length ? helperLive.join("+") : "none"}`);
    }
    return c;
  },
};

// 026 - dynamic_setpoint is written straight to the AC. Without a clamp a bad
//       sensor reading becomes an out-of-range command the unit may reject
//       wholesale, leaving the room uncontrolled.
SUITES["026"] = {
  title: "every computed setpoint is clamped to the AC's accepted range",
  async run() {
    const c = [];
    const r = repo();
    const st = await states();
    for (const room of ROOMS) {
      const res = r.byName.get(room.resource);
      if (!res) { check(c, `C-${room.prefix}`, false, `${room.resource} not found`); continue; }
      const text = allFieldText(res);
      const assigns = [...text.matchAll(/\{%\s*set\s+dynamic_setpoint\s*=\s*([^%]*)%\}/g)].map((m) => m[1]);
      const clamped = assigns.filter((a) => /\[\s*16\s*,/.test(a) && /\[\s*31\s*,/.test(a));
      check(c, `C-${room.prefix}`, assigns.length > 0 && clamped.length === assigns.length,
        `${room.prefix}: dynamic_setpoint assignments=${assigns.length}, clamped to [16,31]=${clamped.length}`);
    }
    // The clamp must match what the hardware actually advertises, so the unit
    // id is read out of the automation instead of being hardcoded here.
    const svc = await serviceNames();
    for (const room of ROOMS) {
      const res = r.byName.get(room.resource);
      if (!res) continue;
      const cl = climateOf(res, svc);
      const e = cl && st.get(cl);
      if (!e) { check(c, `C-range-${room.prefix}`, false, `climate entity for ${room.prefix} (${cl}) absent live`); continue; }
      const lo = e.attributes.min_temp, hi = e.attributes.max_temp;
      // The safety property is containment in this direction: every value the
      // clamp can emit must be one the unit accepts. A unit that accepts a
      // WIDER range than the clamp is not a defect - nobody wants the 10 C the
      // hardware would allow. Asserting the reverse also made this check
      // mode-dependent, because min_temp moves with hvac_mode on these units.
      check(c, `C-range-${room.prefix}`, 16 >= lo && 31 <= hi,
        `${cl} advertises min_temp=${lo} max_temp=${hi}, clamp 16..31 ${16 >= lo && 31 <= hi ? "fits inside it" : "falls outside it"}`);
    }
    return c;
  },
};

// 027 - a helper whose value sits outside its own min/max, or off its own step,
//       cannot be reproduced by --apply and will not survive a rebuild.
SUITES["027"] = {
  title: "every input_number value is inside its declared range and on its step",
  async run() {
    const c = [];
    const r = repo();
    const st = await states();
    const nums = Object.entries(r.helpers.helpers).filter(([id]) => id.startsWith("input_number."));
    check(c, "C1", nums.length > 0, `input_number helpers declared: ${nums.length}`);

    const outOfRange = [];
    const offStep = [];
    const notLive = [];
    for (const [id, h] of nums) {
      const live = st.get(id);
      if (!live) { notLive.push(id); continue; }
      const v = parseFloat(live.state);
      if (isNaN(v)) continue;
      const min = parseFloat(h.min), max = parseFloat(h.max), step = parseFloat(h.step);
      if (!isNaN(min) && !isNaN(max) && (v < min - 1e-9 || v > max + 1e-9)) outOfRange.push(`${id}=${v} not in [${min},${max}]`);
      if (!isNaN(step) && step > 0) {
        const k = (v - (isNaN(min) ? 0 : min)) / step;
        if (Math.abs(k - Math.round(k)) > 1e-6) offStep.push(`${id}=${v} step=${step} min=${min}`);
      }
    }
    check(c, "C2", notLive.length === 0, `declared helpers absent live: ${notLive.length}${notLive.length ? " -> " + notLive.slice(0, 5).join(", ") : ""}`);
    check(c, "C3", outOfRange.length === 0, `values outside their own range: ${outOfRange.length}${outOfRange.length ? " -> " + outOfRange.slice(0, 5).join(", ") : ""}`);
    check(c, "C4", offStep.length === 0, `values not on their own step: ${offStep.length}${offStep.length ? " -> " + offStep.slice(0, 5).join(", ") : ""}`);

    // A target temperature outside a habitable band is a typo, not a setting.
    const targets = nums.filter(([id]) => /_target(_temperature)?$/.test(id));
    const insane = targets.filter(([id]) => {
      const live = st.get(id); if (!live) return false;
      const v = parseFloat(live.state); return !isNaN(v) && (v < 15 || v > 32);
    }).map(([id]) => `${id}=${st.get(id).state}`);
    check(c, "C5", insane.length === 0, `target helpers outside 15..32 C: ${insane.length}${insane.length ? " -> " + insane.join(", ") : ""}`);
    return c;
  },
};

// 028 - three generations of automations exist ([OLD], [V2], [TEST]). If two
//       enabled generations drive the same climate entity they fight, and the
//       loser is whichever ran first.
SUITES["028"] = {
  title: "no climate entity is driven by two enabled automation generations",
  async run() {
    const c = [];
    const r = repo();
    const st = await states();
    const live = await liveConfigs();

    const svc = await serviceNames();
    const meta = await liveMeta();
    const gen = (alias) => {
      if (/^\[OLD\]/i.test(alias)) return "OLD";
      if (/^\[V2\]/i.test(alias)) return "V2";
      if (/^\[TEST\]/i.test(alias)) return "TEST";
      return "PLAIN";
    };

    // Generation is read from the LIVE alias. main.tf is missing the [OLD]
    // prefix on 39 automations (see eval 018), so classifying from the repo
    // would report zero [OLD] automations enabled - a false pass on the exact
    // question this check exists to answer.
    const drivers = new Map();
    for (const res of r.resources) {
      const m = meta.get(res.name);
      if (!m || !m.enabled) continue;
      const text = allFieldText(res);
      if (!/climate\.set_(temperature|hvac_mode)/.test(text)) continue;
      const g = gen(m.liveAlias);
      for (const e of M.entitiesIn(text).filter((x) => x.startsWith("climate.") && !svc.has(x))) {
        if (!st.has(e)) continue;
        if (!drivers.has(e)) drivers.set(e, new Map());
        drivers.get(e).set(g, (drivers.get(e).get(g) || 0) + 1);
      }
    }
    const conflicted = [...drivers.entries()].filter(([, g]) => g.size > 1);
    check(c, "C1", drivers.size > 0, `climate entities under active command: ${drivers.size}`);
    check(c, "C2", conflicted.length === 0,
      `entities commanded by more than one enabled generation: ${conflicted.length}`
      + (conflicted.length ? " -> " + conflicted.map(([e, g]) => `${e} {${[...g.entries()].map(([k, v]) => k + ":" + v).join(",")}}`).join(" | ") : ""));

    const oldEnabled = r.resources.filter((res) => {
      const m = meta.get(res.name);
      return m && m.enabled && gen(m.liveAlias) === "OLD";
    });
    check(c, "C3", oldEnabled.length === 0,
      `[OLD] generation automations still enabled: ${oldEnabled.length}${oldEnabled.length ? " -> " + oldEnabled.slice(0, 5).map((x) => meta.get(x.name).liveAlias).join(" | ") : ""}`);

    // The repo must agree with the instance about which generation something
    // is, or every generation-scoped judgement made from the repo is unsound.
    const genDrift = r.resources.filter((res) => {
      const m = meta.get(res.name);
      return m && gen(m.liveAlias) !== gen(res.fields.alias || "");
    });
    check(c, "C4", genDrift.length === 0,
      `automations whose generation differs between main.tf and live: ${genDrift.length}`
      + (genDrift.length ? ` -> e.g. ${genDrift.slice(0, 3).map((x) => `${x.name} code='${gen(x.fields.alias)}' live='${gen(meta.get(x.name).liveAlias)}'`).join(", ")}` : ""));

    // C2 establishes that two generations CAN command the same unit. Whether
    // they actually do is a separate, measurable question, and answering it is
    // what separates a latent hazard from a live fault. The signature of two
    // writers fighting is the same setpoint changed to two different values
    // within seconds.
    const now = new Date();
    const start = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const pairs = [];
    let scanned = 0;
    for (const unit of drivers.keys()) {
      const hist = await rest(`/api/history/period/${start}?end_time=${encodeURIComponent(now.toISOString())}`
        + `&filter_entity_id=${unit}`, "GET");
      const pts = (hist[0] || []).map((p) => ({
        t: new Date(p.last_changed || p.last_updated),
        sp: p.attributes && p.attributes.temperature,
      })).filter((p) => p.sp !== undefined);
      const changes = pts.filter((p, i) => i > 0 && p.sp !== pts[i - 1].sp);
      scanned += changes.length;
      for (let i = 1; i < changes.length; i += 1) {
        const dt = (changes[i].t - changes[i - 1].t) / 1000;
        if (dt <= 30 && changes[i].sp !== changes[i - 1].sp) {
          pairs.push(`${unit} ${changes[i].t.toISOString().slice(5, 16)} ${changes[i - 1].sp}->${changes[i].sp} in ${dt.toFixed(0)}s`);
        }
      }
    }
    check(c, "C5", pairs.length === 0,
      `override pairs observed in 7 days (same unit, two values within 30s): ${pairs.length}/${scanned} setpoint changes`
      + (pairs.length ? " -> " + pairs.slice(0, 4).join(", ") : ""));
    return c;
  },
};

// 029 - eval 004's staleness guard. A room sensor that stops reporting keeps
//       its last value forever; without the guard the loop keeps controlling on
//       a frozen number.
SUITES["029"] = {
  title: "every room's comfort band still guards against a stale or flat battery sensor",
  async run() {
    const c = [];
    const r = repo();
    const st = await states();
    for (const room of ROOMS) {
      const res = r.byName.get(room.resource);
      if (!res) { check(c, `C-${room.prefix}`, false, `${room.resource} not found`); continue; }
      const text = allFieldText(res);
      const stale = text.includes("room_sensor_stale_hours");
      const lastMoved = /_last_moved/.test(text);
      const battery = /_min_battery/.test(text) && /battery_level/.test(text);
      check(c, `C-${room.prefix}`, stale && lastMoved && battery,
        `${room.prefix}: stale_hours=${stale}, last_moved=${lastMoved}, battery guard=${battery}`);
    }
    // The threshold helper is per room, not shared.
    const missing = ROOMS.map((x) => `input_number.${x.prefix}_room_sensor_stale_hours`).filter((h) => !st.has(h));
    check(c, "C-helpers", missing.length === 0,
      `per-room staleness threshold helpers live: ${ROOMS.length - missing.length}/${ROOMS.length}${missing.length ? " missing " + missing.join(", ") : ""}`);

    // Freshness is asserted only for sensors the enabled comfort bands actually
    // read. The house has other Xiaomi sensors lying around; a dead one that no
    // control loop consults is not a control defect.
    const now = Date.now();
    const rows = [];
    for (const room of ROOMS) {
      const res = r.byName.get(room.resource);
      if (!res) continue;
      const limitEnt = st.get(`input_number.${room.prefix}_room_sensor_stale_hours`);
      const limit = limitEnt ? parseFloat(limitEnt.state) : 5;
      const used = M.entitiesIn(allFieldText(res)).filter((e) => /^sensor\..*_temperature$/.test(e) && st.has(e));
      for (const e of used) {
        rows.push({ room: room.prefix, id: e, h: (now - new Date(st.get(e).last_changed)) / 3600000, limit });
      }
    }
    const overdue = rows.filter((x) => x.h > x.limit);
    const stalest = rows.slice().sort((a, b) => b.h - a.h)[0];
    check(c, "C-fresh", overdue.length === 0,
      `sensors read by the enabled comfort bands that are past their own threshold: ${overdue.length}/${rows.length}`
      + (overdue.length ? " -> " + overdue.slice(0, 4).map((x) => `${x.id} ${x.h.toFixed(1)}h>${x.limit}h (${x.room})`).join(", ")
        : stalest ? ` (stalest ${stalest.id} ${stalest.h.toFixed(2)}h of ${stalest.limit}h)` : ""));
    return c;
  },
};

function asArr(v) { return Array.isArray(v) ? v : (v === undefined || v === null ? [] : [v]); }
function dupes(arr) {
  const seen = new Set(), out = new Set();
  for (const x of arr) { if (seen.has(x)) out.add(x); seen.add(x); }
  return [...out];
}

// --------------------------------------------------------------------- main

async function main() {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes("--json");
  const all = argv.includes("--all");
  const one = (() => { const i = argv.indexOf("--eval"); return i >= 0 ? argv[i + 1] : null; })();
  const ids = all ? Object.keys(SUITES).sort() : (one ? [one] : []);
  if (!ids.length) {
    console.error("usage: validate_logic.js --eval <id> | --all [--json]");
    process.exit(2);
  }

  const summary = [];
  for (const id of ids) {
    const suite = SUITES[id];
    if (!suite) { console.error(`unknown eval ${id}`); process.exit(2); }
    let checks;
    try {
      checks = await suite.run();
    } catch (e) {
      checks = [{ id: "ERROR", ok: false, detail: `suite threw: ${e.message}` }];
    }
    const passed = checks.filter((x) => x.ok).length;
    if (!wantJson) {
      console.log(`\n=== ${id}  ${suite.title} ===`);
      for (const x of checks) console.log(`  ${x.ok ? "PASS" : "FAIL"} ${x.id.padEnd(14)} ${x.detail}`);
      console.log(`  -> ${passed}/${checks.length}`);
    }
    summary.push({ id, title: suite.title, passed, total: checks.length, checks });
  }

  if (wantJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("\n================ SUMMARY ================");
    for (const s of summary) {
      console.log(`  ${s.passed === s.total ? "PASS" : "FAIL"}  ${s.id}  ${s.passed}/${s.total}  ${s.title}`);
    }
  }
  process.exit(summary.every((s) => s.passed === s.total) ? 0 : 1);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { SUITES };
