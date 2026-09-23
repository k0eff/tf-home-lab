// Eval 040 - stop the comfort bands discarding their own clock triggers.
//
// Each comfort band runs in mode single with a time_pattern trigger every 5
// minutes and clock triggers at 00:30, 03:00, 06:00, 08:30 (and 19:30 for
// BedroomS). Every clock time sits on a 5-minute boundary, so the two fire in
// the same second and single mode discards whichever starts second. A branch
// gated on the clock trigger's id - BedroomS night fixed cooling at 19:30 -
// then fires on some nights and not on others. system_log confirmed it:
// "Already running" at exactly 19:30:00 on 2026-09-22, and the handover did
// not latch on 2026-09-22 or 2026-09-23.
//
// queued runs them one after another. Checked first: no delay / wait in any
// of the three, and none writes to its own triggers, so the queue cannot grow
// or loop. No explicit max - the Terraform provider cannot express one.
//
//   node apply_comfort_band_queued_mode.js          dry run
//   node apply_comfort_band_queued_mode.js --yes    apply
//
// Env: HA_BASE, HA_TOKEN.

const { rest } = require("./ha_ws_util");

const AUTOMATIONS = [
  { room: "livingr",  id: "1770077000010" },
  { room: "bedroomb", id: "1770077000021" },
  { room: "bedrooms", id: "1770077000061" },
];

async function main() {
  const write = process.argv.includes("--yes");
  let changed = 0;
  for (const a of AUTOMATIONS) {
    const cfg = await rest(`/api/config/automation/config/${a.id}`);
    const acts = JSON.stringify(cfg.actions || cfg.action);
    if (/"delay"|wait_template|wait_for_trigger/.test(acts)) {
      throw new Error(`${a.room}: has a delay or wait - queued could accumulate runs; refusing`);
    }
    if (cfg.mode === "queued" && cfg.max === undefined) { console.log(`${a.room.padEnd(9)} already queued - no-op`); continue; }
    if (cfg.mode !== "single" && cfg.mode !== undefined) {
      throw new Error(`${a.room}: unexpected mode ${cfg.mode}; refusing to change it blindly`);
    }
    console.log(`${a.room.padEnd(9)} mode ${cfg.mode || "single(default)"} -> queued`);
    changed += 1;
    if (!write) continue;

    const next = { ...cfg, mode: "queued" };
    delete next.max;
    await rest(`/api/config/automation/config/${a.id}`, "POST", next);
    const after = await rest(`/api/config/automation/config/${a.id}`);
    if (after.mode !== "queued" || after.max !== undefined) throw new Error(`${a.room}: verify failed (mode=${after.mode}, max=${after.max})`);
    // Nothing else may move: compare everything except mode.
    const strip = (c) => JSON.stringify({ ...c, mode: undefined });
    if (strip(after) !== strip(cfg)) throw new Error(`${a.room}: a field other than mode changed on save`);
    console.log(`          written and verified (mode queued, all other fields byte-identical)`);
  }
  if (write && changed) { await rest("/api/services/automation/reload", "POST", {}); console.log("automations reloaded"); }
  console.log(write ? `done - ${changed} changed` : `dry run - ${changed} would change (pass --yes)`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
