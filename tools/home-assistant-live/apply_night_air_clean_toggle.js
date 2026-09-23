// Eval 038 - give the night air-clean window an owner-facing off switch.
//
// The air-clean branch forces fan_only at boost speed for the whole window,
// unconditionally. Reported 2026-09-23: BedroomB blows hard 03:00-06:00 over a
// sleeping person. No helper value can disable it - equal start/end times make
// the window formula's wrap branch always true, so air-clean would run forever.
//
// The gate goes on the night_air_clean_window VARIABLE rather than on the
// branch. Branches 1 and 6 (the ones that park the unit off) both require
// `not night_air_clean_window`, so gating only the air-clean branch would leave
// whatever is running at 02:59 stuck until 06:00. Gating the variable turns
// 03:00-06:00 into ordinary sleep window, which parks the unit off.
//
// The set-line is byte-identical in all three rooms, so every edit is scoped to
// one automation / one resource block - the hazard eval 014 documented.
//
//   node apply_night_air_clean_toggle.js          dry run
//   node apply_night_air_clean_toggle.js --yes    apply
//
// Env: HA_BASE, HA_TOKEN.

const { connectWs, rest } = require("./ha_ws_util");

const ROOMS = [
  { room: "livingr",  id: "1770077000010", expect: 30, name: "LivingR Allow Night Air Clean",  seed: "on"  },
  { room: "bedroomb", id: "1770077000021", expect: 35, name: "BedroomB Allow Night Air Clean", seed: "off" },
  { room: "bedrooms", id: "1770077000061", expect: 32, name: "BedroomS Allow Night Air Clean", seed: "on"  },
];

const UNGATED =
  "{% set night_air_clean_window = (minutes_now >= air_clean_start_minutes and minutes_now < air_clean_end_minutes) " +
  "if air_clean_start_minutes < air_clean_end_minutes else " +
  "(minutes_now >= air_clean_start_minutes or minutes_now < air_clean_end_minutes) %}";

const gated = (room) =>
  "{% set night_air_clean_window = ((minutes_now >= air_clean_start_minutes and minutes_now < air_clean_end_minutes) " +
  "if air_clean_start_minutes < air_clean_end_minutes else " +
  "(minutes_now >= air_clean_start_minutes or minutes_now < air_clean_end_minutes)) " +
  `and is_state('input_boolean.${room}_allow_night_air_clean', 'on') %}`;

// Walk every string leaf: the variable lives in condition templates, in action
// data templates and inside the logbook message alike.
function mapStrings(node, fn) {
  if (typeof node === "string") return fn(node);
  if (Array.isArray(node)) return node.map((v) => mapStrings(v, fn));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = mapStrings(v, fn);
    return out;
  }
  return node;
}

const countOf = (cfg, needle) => JSON.stringify(cfg).split(JSON.stringify(needle).slice(1, -1)).length - 1;

async function ensureHelper(ws, r) {
  const entityId = `input_boolean.${r.room}_allow_night_air_clean`;
  const states = await rest("/api/states");
  if (states.some((s) => s.entity_id === entityId)) return `exists  ${entityId}`;
  const res = await ws.request({
    name: r.name, icon: "mdi:weather-night-partly-cloudy",
    id: Date.now() % 100000, type: "input_boolean/create",
  });
  if (!res.success) throw new Error(`create ${entityId} failed: ${JSON.stringify(res.error || res)}`);
  await rest(`/api/services/input_boolean/turn_${r.seed}`, "POST", { entity_id: entityId });
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
      const before = countOf(cfg, UNGATED);
      const already = countOf(cfg, gated(r.room));

      if (before === 0 && already === r.expect) { console.log(`  already gated (${already}) - no-op`); continue; }
      if (before !== r.expect) {
        throw new Error(`${r.room}: expected ${r.expect} ungated set-lines, found ${before} (already gated: ${already})`);
      }

      const patched = mapStrings(cfg, (s) => s.split(UNGATED).join(gated(r.room)));
      console.log(`  ${before} set-line(s) gated on input_boolean.${r.room}_allow_night_air_clean`);
      changed += 1;
      if (!write) { console.log("  (dry run)"); continue; }

      await rest(`/api/config/automation/config/${r.id}`, "POST", patched);

      const after = await rest(`/api/config/automation/config/${r.id}`);
      const leftover = countOf(after, UNGATED);
      const now = countOf(after, gated(r.room));
      if (leftover !== 0) throw new Error(`${r.room}: ${leftover} ungated set-lines survive`);
      if (now !== r.expect) throw new Error(`${r.room}: ${now} gated set-lines, expected ${r.expect}`);
      // No other room's gate may have leaked in.
      for (const other of ROOMS) {
        if (other.room === r.room) continue;
        if (JSON.stringify(after).includes(`${other.room}_allow_night_air_clean`)) {
          throw new Error(`${r.room}: leaked a reference to ${other.room}_allow_night_air_clean`);
        }
      }
      console.log(`  written and verified (${now} gated, 0 ungated, no cross-room leak)`);
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
