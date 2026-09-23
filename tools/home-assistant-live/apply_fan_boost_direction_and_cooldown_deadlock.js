// Eval 039 - finish eval 014 for LivingR and BedroomS.
//
// Eval 014 fixed BedroomB in July and explicitly deferred the other two rooms.
// On 2026-09-23 LivingR stranded in fan_only on exactly the deferred defects:
//
// (1) The fan-boost latch arms on `(error | abs) >= fan_boost_threshold`. abs()
//     is season-blind, so a room far BELOW its summer target latches the boost
//     as hard as one far above it - every autumn day, since September counts
//     as summer. Replaced with eval 014's boost_error, which is error in summer
//     and -error in winter: boost arms only on the uncomfortable side of target
//     in each season, and eval 006's winter-undershoot boost survives.
//
// (3) With the latch on, cooling_fan_mode resolves to the boost speed while the
//     unit sits at the normal one, and the only branch that turns the unit off
//     after coil cool-down requires fan_mode == cooling_fan_mode. '2' == '5' is
//     never true, so nothing can ever turn the unit off. The clause is dropped;
//     the remaining ones already say "cooling is over".
//
// Eval 014's defect (2), the conflict_worst_case resolver, is present in both
// rooms but deliberately NOT touched here - it changes which temperature counts
// as the room, and the stratification that justified it in BedroomB has not
// been measured for these two rooms.
//
// The replacement text is byte-identical to eval 014's BedroomB fix.
//
//   node apply_fan_boost_direction_and_cooldown_deadlock.js         dry run
//   node apply_fan_boost_direction_and_cooldown_deadlock.js --yes   apply
//
// Env: HA_BASE, HA_TOKEN.

const { rest } = require("./ha_ws_util");

const ROOMS = [
  { room: "livingr",  id: "1770077000010", climate: "climate.hol_2" },
  { room: "bedrooms", id: "1770077000061", climate: "climate.v537_spalniam_2" },
];

const BOOST_ERROR_DEF =
  "{% set boost_error = none if error is none else (error if climate_mode == 'summer' else (0 - error)) %}\n";

const edits = (r) => [
  {
    label: "latch ON",
    from: "{{ error is not none and (error | abs) >= fan_boost_threshold }}",
    to: BOOST_ERROR_DEF + "{{ boost_error is not none and boost_error >= fan_boost_threshold }}",
  },
  {
    label: "latch RELEASE",
    from:
      `{{ is_state('input_boolean.${r.room}_fan_boost_active', 'on') and error is not none and (error | abs) < (fan_boost_threshold - fan_boost_effective_margin) }}`,
    to:
      BOOST_ERROR_DEF +
      `{{ is_state('input_boolean.${r.room}_fan_boost_active', 'on') and (boost_error is none or boost_error < (fan_boost_threshold - fan_boost_effective_margin)) }}`,
  },
  {
    label: "cool-down off: drop fan-equality clause",
    from: `(state_attr('${r.climate}', 'fan_mode') or '') == (cooling_fan_mode | string) and `,
    to: "",
  },
];

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

function leaves(node, out = []) {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((v) => leaves(v, out));
  else if (node && typeof node === "object") Object.values(node).forEach((v) => leaves(v, out));
  return out;
}
const count = (cfg, needle) => leaves(cfg).reduce((n, s) => n + (s.split(needle).length - 1), 0);

async function main() {
  const write = process.argv.includes("--yes");
  let changed = 0;

  for (const r of ROOMS) {
    console.log(`\n=== ${r.room} (${r.id}) ===`);
    const cfg = await rest(`/api/config/automation/config/${r.id}`);
    const E = edits(r);
    const pre = E.map((e) => count(cfg, e.from));
    const boostDefs = count(cfg, "{% set boost_error");

    if (pre.every((n) => n === 0) && boostDefs === 2 && count(cfg, "(error | abs)") === 0) {
      console.log("  already applied - no-op");
      continue;
    }
    E.forEach((e, i) => {
      if (pre[i] !== 1) throw new Error(`${r.room}: '${e.label}' expected exactly 1 occurrence, found ${pre[i]}`);
    });

    const patched = mapStrings(cfg, (s) => E.reduce((acc, e) => acc.split(e.from).join(e.to), s));
    E.forEach((e) => console.log(`  ${e.label}: 1 -> patched`));
    changed += 1;
    if (!write) { console.log("  (dry run)"); continue; }

    await rest(`/api/config/automation/config/${r.id}`, "POST", patched);
    const after = await rest(`/api/config/automation/config/${r.id}`);
    const abs = count(after, "(error | abs)");
    const defs = count(after, "{% set boost_error");
    const eq = count(after, `(state_attr('${r.climate}', 'fan_mode') or '') == (cooling_fan_mode | string)`);
    if (abs !== 0 || defs !== 2 || eq !== 0) {
      throw new Error(`${r.room}: post-write verify failed (abs=${abs}, boost_error defs=${defs}, fan-eq=${eq})`);
    }
    console.log(`  written and verified (abs 0, boost_error defs 2, fan-eq 0)`);
  }

  if (write && changed) {
    await rest("/api/services/automation/reload", "POST", {});
    console.log("\nautomations reloaded");
  }
  console.log(write ? `\ndone - ${changed} automation(s) changed` : `\ndry run - ${changed} automation(s) would change (pass --yes)`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
