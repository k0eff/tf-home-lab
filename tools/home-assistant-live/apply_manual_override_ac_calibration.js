// Eval 035 - manual override target becomes room-side, calibrated per room.
//
// Before: the three manual override automations wrote
// input_number.<room>_manual_target_temperature straight into
// climate.set_temperature. That number lands on the AC's own thermostat, which
// regulates by the AC's internal sensor and settles below its own setpoint, so
// the occupied zone ended up well under what the helper said. Measured on
// BedroomB 2026-08-17/18: helper 24.8, device held 25.0, bed-level sensor
// averaged 22.97 over 6.5 hours.
//
// After: the automation adds input_number.<room>_manual_ac_calibration_offset
// and snaps the sum to the device's 0.5 grid before writing it. The helper the
// user edits is room-side; the AC-side number is derived and logged.
//
// The offset helper is a plain setting, not a learner - nothing rewrites it.
// It is deliberately NOT named *_stratification_offset: helpers_sync.js exempts
// that suffix from value-drift enforcement, and this value must be enforced.
//
//   node apply_manual_override_ac_calibration.js            dry run, prints diff
//   node apply_manual_override_ac_calibration.js --yes      applies
//
// Env: HA_BASE, HA_TOKEN.

const { connectWs, rest } = require("./ha_ws_util");

const ROOMS = [
  { room: "livingr",  id: "1770077000041", climate: "climate.hol_2",           name: "LivingR Manual AC Calibration Offset",  seed: 0.0 },
  { room: "bedroomb", id: "1770077000042", climate: "climate.v357_spalniag_2", name: "BedroomB Manual AC Calibration Offset", seed: 1.0 },
  { room: "bedrooms", id: "1770077000063", climate: "climate.v537_spalniam_2", name: "BedroomS Manual AC Calibration Offset", seed: 0.0 },
];

const HELPER_CONFIG = { min: -3, max: 5, step: 0.1, mode: "box", unit_of_measurement: "°C", icon: "mdi:target-variant" };

// Three generations of this template exist and the script must accept the first
// two as patchable pre-states: v0 is the original uncalibrated write, v1 applied
// the offset in every hvac mode (wrong - the offset is a COOLING measurement and
// flips sign in heat), v2 gates it on cool.
const templateV0 = (room) =>
  `{{ states('input_number.${room}_manual_target_temperature') | float(24) }}`;

const templateV1 = (room) =>
  `{% set manual_target = states('input_number.${room}_manual_target_temperature') | float(24) %}\n` +
  `{% set calibration_offset = states('input_number.${room}_manual_ac_calibration_offset') | float(0) %}\n` +
  `{{ [16, [31, (((manual_target + calibration_offset) * 2) | round(0)) / 2] | min] | max }}`;

// The offset corrects two cooling-direction errors: the unit settling below its
// own setpoint while cooling, and its intake sensor sitting above the occupied
// zone. Neither carries over to heat - the first reverses sign - and no room has
// a heat-side measurement. Outside cool the offset is zero, i.e. v0 behaviour.
const offsetExpr = (room) =>
  `{% set cooling = is_state('input_select.${room}_manual_hvac_mode', 'cool') %}\n` +
  `{% set calibration_offset = (states('input_number.${room}_manual_ac_calibration_offset') | float(0)) if cooling else 0 %}\n`;

const newTemplate = (room) =>
  `{% set manual_target = states('input_number.${room}_manual_target_temperature') | float(24) %}\n` +
  offsetExpr(room) +
  `{{ [16, [31, (((manual_target + calibration_offset) * 2) | round(0)) / 2] | min] | max }}`;

const oldLogbook = (room) =>
  `target={{ states('input_number.${room}_manual_target_temperature') }}`;

const newLogbook = (room) =>
  `target={{ states('input_number.${room}_manual_target_temperature') }}` +
  `, ac_applied={% set manual_target = states('input_number.${room}_manual_target_temperature') | float(24) %}` +
  offsetExpr(room).replace(/\n/g, "") +
  `{{ [16, [31, (((manual_target + calibration_offset) * 2) | round(0)) / 2] | min] | max }}` +
  ` (offset {{ calibration_offset if calibration_offset is defined else 'n/a' }})`;

// Home Assistant renamed the service-call key from "service" to "action", and
// the top-level trigger/condition/action keys to their plural forms. A config
// that has never been POSTed back still carries the old shape; the moment this
// script (or any sibling apply_* script) saves it, HA rewrites the whole
// automation. Both forms are live in this instance, so every lookup accepts either.
const callOf = (node) => (typeof node.action === "string" ? node.action : node.service);
const actionsOf = (cfg) => (Array.isArray(cfg.actions) ? cfg.actions : cfg.action);

function findSetTemperature(cfg) {
  const hits = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === "object") {
      if (callOf(node) === "climate.set_temperature" && node.data && typeof node.data.temperature === "string") {
        hits.push({ node, path });
      }
      return Object.entries(node).forEach(([k, v]) => walk(v, `${path}.${k}`));
    }
  };
  walk(actionsOf(cfg), "actions");
  return hits;
}

function findLogbook(cfg, room) {
  const hits = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      if (callOf(node) === "logbook.log" && node.data && typeof node.data.message === "string"
          && node.data.message.includes(`input_number.${room}_manual_target_temperature`)) {
        hits.push(node);
      }
      return Object.values(node).forEach(walk);
    }
  };
  walk(actionsOf(cfg));
  return hits;
}

async function ensureHelper(ws, r) {
  const entityId = `input_number.${r.room}_manual_ac_calibration_offset`;
  const states = await rest("/api/states");
  if (states.some((s) => s.entity_id === entityId)) return `exists  ${entityId}`;
  const res = await ws.request({ ...HELPER_CONFIG, name: r.name, id: Date.now() % 100000, type: "input_number/create" });
  if (!res.success) throw new Error(`create ${entityId} failed: ${JSON.stringify(res.error || res)}`);
  await rest("/api/services/input_number/set_value", "POST", { entity_id: entityId, value: r.seed });
  return `created ${entityId} = ${r.seed}`;
}

async function main() {
  const write = process.argv.includes("--yes");
  const ws = write ? await connectWs() : null;
  let changed = 0;

  try {
    for (const r of ROOMS) {
      console.log(`\n=== ${r.room} (${r.id}) ===`);

      if (write) console.log("  helper:", await ensureHelper(ws, r));

      const cfg = await rest(`/api/config/automation/config/${r.id}`);
      const temps = findSetTemperature(cfg);
      if (temps.length !== 1) throw new Error(`${r.room}: expected exactly 1 climate.set_temperature, found ${temps.length}`);
      const logs = findLogbook(cfg, r.room);
      if (logs.length !== 1) throw new Error(`${r.room}: expected exactly 1 manual-override logbook.log, found ${logs.length}`);

      const tCur = temps[0].node.data.temperature;
      const lCur = logs[0].data.message;
      const tDone = tCur === newTemplate(r.room);
      const lDone = lCur.includes("ac_applied=");
      // Exact match, not a substring probe: a half-migrated message can contain
      // the new gating expression and still carry a malformed tail.
      const lCurrent = lCur.includes(newLogbook(r.room) + ", fan=");

      if (tDone && lCurrent) { console.log("  already applied - no-op"); continue; }
      const patchable = [templateV0(r.room), templateV1(r.room)];
      if (!tDone && !patchable.includes(tCur)) {
        throw new Error(`${r.room}: unexpected set_temperature template, refusing to patch:\n    ${tCur}`);
      }
      if (!lDone && !lCur.includes(oldLogbook(r.room))) {
        throw new Error(`${r.room}: unexpected logbook message, refusing to patch:\n    ${lCur}`);
      }

      temps[0].node.data.temperature = newTemplate(r.room);
      // Rebuild the reporting clause between "target=" and ", fan=" rather than
      // pattern-matching the old one. The previous generation ended in
      // "(offset {{ states('...') }})", whose first ")" sits inside states(...),
      // so any [^)]* style match truncates and leaves a " }})" fragment behind.
      const clauseRe = new RegExp(
        `target=\\{\\{ states\\('input_number\\.${r.room}_manual_target_temperature'\\) \\}\\}.*?, fan=`);
      if (!clauseRe.test(lCur)) throw new Error(`${r.room}: cannot locate the target=...,fan= clause in the logbook message`);
      logs[0].data.message = lCur.replace(clauseRe, newLogbook(r.room) + ", fan=");

      console.log(`  set_temperature ${temps[0].path}`);
      console.log(`    - ${tCur}`);
      console.log(`    + ${newTemplate(r.room).replace(/\n/g, "\\n")}`);
      changed += 1;

      if (!write) { console.log("  (dry run)"); continue; }

      await rest(`/api/config/automation/config/${r.id}`, "POST", cfg);

      const after = await rest(`/api/config/automation/config/${r.id}`);
      const aTemps = findSetTemperature(after);
      if (aTemps.length !== 1 || aTemps[0].node.data.temperature !== newTemplate(r.room)) {
        throw new Error(`${r.room}: post-write verify failed`);
      }
      const raw = JSON.stringify(after);
      for (const [gen, txt] of [["v0", templateV0(r.room)], ["v1", templateV1(r.room)]]) {
        const stale = raw.split(JSON.stringify(txt).slice(1, -1)).length - 1;
        if (stale !== 0) throw new Error(`${r.room}: ${stale} copies of the ${gen} template survive`);
      }
      const dup = (raw.match(/ac_applied=/g) || []).length;
      if (dup !== 1) throw new Error(`${r.room}: logbook carries ${dup} ac_applied= clauses, expected 1`);
      const aLogs = findLogbook(after, r.room);
      // rest() JSON-parses the response and the logbook message renders to bare
      // prose, so wrap it in to_json to get something parseable back.
      const rendered = await rest("/api/template", "POST", {
        template: `{% set out %}${aLogs[0].data.message}{% endset %}{{ out | to_json }}`,
      });
      if (/\}\}|\{\{|\{%/.test(String(rendered))) {
        throw new Error(`${r.room}: logbook message renders with leftover template syntax:\n    ${rendered}`);
      }
      console.log(`  logbook renders: ${String(rendered).trim()}`);
      console.log("  written and verified");
    }

    if (write && changed) {
      await rest("/api/services/automation/reload", "POST", {});
      console.log("\nautomations reloaded");
    }
  } finally {
    if (ws) ws.close();
  }

  console.log(write ? `\ndone - ${changed} automation(s) changed` : `\ndry run - ${changed} automation(s) would change (pass --yes)`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
