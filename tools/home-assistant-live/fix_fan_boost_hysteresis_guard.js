/**
 * fix_fan_boost_hysteresis_guard.js
 *
 * Adversarial review of the fan-speed-boost feature found that when a user
 * sets input_number.<prefix>_fan_boost_release_margin >= _fan_boost_threshold
 * (both ranges allow this), the latch's OFF condition becomes
 * `(error|abs) < (threshold - margin)` with a non-positive RHS, which is
 * unsatisfiable for any real error -- the latch can never self-release.
 * Patches the already-live "Track fan-speed boost latch" action's OFF
 * template (else[0].if[0].value_template) on all 3 rooms to clamp the
 * effective margin below the threshold, guaranteeing a reachable release
 * point. One-off live fix; also mirrors the same guard into main.tf.
 */

const { rest } = require("./ha_ws_util");
const fs = require("fs");
const path = require("path");

const ROOMS = [
  { prefix: "livingr", automationId: "1770077000010" },
  { prefix: "bedroomb", automationId: "1770077000021" },
  { prefix: "bedrooms", automationId: "1770077000061" },
];

function oldOffTail(prefix) {
  return `{% set fan_boost_release_margin = states('input_number.${prefix}_fan_boost_release_margin') | float(0.5) %}\n{{ is_state('input_boolean.${prefix}_fan_boost_active', 'on') and error is not none and (error | abs) < (fan_boost_threshold - fan_boost_release_margin) }}`;
}

function newOffTail(prefix) {
  return `{% set fan_boost_release_margin = states('input_number.${prefix}_fan_boost_release_margin') | float(0.5) %}\n{% set fan_boost_effective_margin = [fan_boost_release_margin, fan_boost_threshold - 0.01] | min %}\n{{ is_state('input_boolean.${prefix}_fan_boost_active', 'on') and error is not none and (error | abs) < (fan_boost_threshold - fan_boost_effective_margin) }}`;
}

async function fixLive(room) {
  const config = await rest(`/api/config/automation/config/${room.automationId}`);
  const action = config.actions.find((a) => a.alias && a.alias.startsWith("Track fan-speed boost latch"));
  if (!action) throw new Error(`${room.prefix}: latch action not found`);
  const off = action.else[0].if[0];
  const oldTail = oldOffTail(room.prefix);
  if (!off.value_template.includes(oldTail)) {
    if (off.value_template.includes(newOffTail(room.prefix))) return "already-fixed";
    throw new Error(`${room.prefix}: old OFF template tail not found (unexpected structure)`);
  }
  off.value_template = off.value_template.replace(oldTail, newOffTail(room.prefix));
  await rest(`/api/config/automation/config/${room.automationId}`, "POST", config);
  return "patched";
}

function fixMainTf() {
  const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");
  let text = fs.readFileSync(MAIN_TF, "utf8");
  let changed = 0;
  for (const room of ROOMS) {
    const oldTailHcl = oldOffTail(room.prefix).replace(/\n/g, "\\n");
    const newTailHcl = newOffTail(room.prefix).replace(/\n/g, "\\n");
    if (!text.includes(oldTailHcl)) {
      if (text.includes(newTailHcl)) continue;
      throw new Error(`${room.prefix}: old OFF template tail not found in main.tf`);
    }
    text = text.split(oldTailHcl).join(newTailHcl);
    changed++;
  }
  // fmt-alignment fix for the "condition" key inside the new latch action's
  // if/else.if blocks. The same misaligned 2-line shape also occurs
  // elsewhere in this file (pre-existing, out of scope) -- 14 total vs 6
  // inside the 3 new latch actions -- so the fix is windowed to just after
  // each "Track fan-speed boost latch" alias, not applied file-wide.
  // Indentation differs between the top-level "if" (10 spaces) and the
  // nested "else[0].if" (14 spaces) blocks, so match indentation per-line
  // via a captured backreference rather than a fixed-width literal.
  const misalignedRe = /^(\s*)"condition" = "template"\n\1"value_template" = "/gm;
  const aliasMarker = '"alias" = "Track fan-speed boost latch (error threshold trigger)"';
  const WINDOW = 20000;
  let alignmentFixes = 0;
  let searchFrom = 0;
  const aliasPositions = [];
  while (true) {
    const idx = text.indexOf(aliasMarker, searchFrom);
    if (idx < 0) break;
    aliasPositions.push(idx);
    searchFrom = idx + aliasMarker.length;
  }
  if (aliasPositions.length !== 3) throw new Error(`expected 3 latch action aliases, found ${aliasPositions.length}`);
  for (const idx of aliasPositions) {
    const windowEnd = Math.min(idx + WINDOW, text.length);
    const before = text.slice(0, idx);
    const window = text.slice(idx, windowEnd);
    const after = text.slice(windowEnd);
    const windowMatches = window.match(misalignedRe) || [];
    if (windowMatches.length !== 2) throw new Error(`expected exactly 2 misaligned "condition" lines in this latch action's window, found ${windowMatches.length}`);
    const fixedWindow = window.replace(misalignedRe, (m, indent) => `${indent}"condition"      = "template"\n${indent}"value_template" = "`);
    text = before + fixedWindow + after;
    alignmentFixes += windowMatches.length;
  }
  fs.writeFileSync(MAIN_TF, text);
  return { roomsPatched: changed, alignmentFixes };
}

(async () => {
  const results = {};
  for (const room of ROOMS) {
    results[room.prefix] = await fixLive(room);
  }
  await rest("/api/services/automation/reload", "POST", {});
  const tfResult = fixMainTf();
  console.log(JSON.stringify({ live: results, mainTf: tfResult }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
