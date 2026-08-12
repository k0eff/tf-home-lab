// Eval 015 - normalise every BedroomB temperature source into one reference
// frame before comparing or falling back between them.
//
// The chain reads three sensors mounted at two different heights:
//   primary   sensor.miaomiaoce_t2_5249_temperature   - occupied level
//   secondary sensor.miaomiaoce_t2_faea_temperature   - near the ceiling
//   ac_temp   climate.v357_spalniag_2 current_temperature - the unit's own
//             return-air probe, also near the ceiling
// Natural convection keeps the ceiling warmer, so the high-mounted readings are
// not the same quantity as the occupied-level one. Measured over 24h against
// the primary: ac_temp - primary mean 1.18C p50 1.30C, secondary - primary
// mean 1.31C p50 1.30C, stable across hvac modes (cool 1.25/1.36, fan_only
// 1.02/1.42, off 1.27/1.08).
//
// The old chain compared and substituted them raw, which broke twice:
//
//   room_ac_conflict = ... (candidate - ac_temp) | abs >= threshold
// With eval 014 lowering the threshold to 1.0C, a NORMAL 1.3C stratification
// gap trips this permanently. The flag stopped reporting sensor disagreement
// and started reporting the laws of thermodynamics.
//
//   {% set candidate = ac_temp %}          (climate_fallback branch)
//   {% set candidate = secondary_room %}   (secondary branch)
// Both substitute a ceiling reading into a comfort band calibrated for
// occupied level, biasing the whole band ~1.3C high and overcooling the room
// by exactly the stratification gap - the same defect eval 014 removed from
// the conflict resolver, still live in the fallback path.
//
// Fix: learn the offset of each high-mounted source relative to the primary
// and subtract it before use, so every comparison is like-for-like.
//   ac_temp_occupied = ac_temp - ac_stratification_offset
//   secondary        = secondary_room - secondary_stratification_offset
// Learned, not configured: no assumption about where anything is mounted is
// baked in. Co-located sensors converge to ~0 and nothing changes; a ceiling
// sensor converges to the real gap. Learning is gated on the primary being
// healthy, so when the primary dies the offset freezes at its last good value
// - which is precisely the value the fallback then needs.
//
// dynamic_setpoint keeps using RAW ac_temp on purpose: that number is consumed
// by the unit's own controller, which measures in its own reference frame.
//
// Smoothing is 95/5, not the 70/30 used for learned_overshoot, because this
// automation runs on a 5-minute time_pattern plus sensor-change triggers.
// 95/5 gives a ~1.5-2h time constant and tracks the TYPICAL gap; a fast EMA
// would absorb genuine sensor disagreement into the offset and quietly disable
// the conflict detector it is supposed to make meaningful.
//
// BedroomB only, same scope containment as eval 014.
//
// Run: HA_BASE=... HA_TOKEN=... node apply_bedroomb_stratification_offset.js

const { connectWs, rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000021";
const AUTOMATION_ENTITY = "automation.test_aircon_bedroomb_room_sensor_comfort_band";
const CLIMATE = "climate.v357_spalniag_2";
const PRIMARY = "sensor.miaomiaoce_t2_5249_temperature";
const SECONDARY = "sensor.miaomiaoce_t2_faea_temperature";

// NOTE: HA's websocket input_number/create ignores any requested id and derives
// the entity id from the friendly name, so these two constants must stay
// consistent with HELPER_NAMES below - ensureInputNumber asserts that they are.
const AC_OFFSET = "input_number.bedroomb_ac_stratification_offset";
const SECONDARY_OFFSET = "input_number.bedroomb_ceiling_sensor_stratification_offset";
const AC_OFFSET_NAME = "BedroomB AC Stratification Offset";
const SECONDARY_OFFSET_NAME = "BedroomB Ceiling Sensor Stratification Offset";

// Seeded from the measured 24h means so the correction is calibrated on its
// first run rather than converging from cold.
const AC_OFFSET_SEED = 1.2;
const SECONDARY_OFFSET_SEED = 1.3;
const OFFSET_MIN = -3;
const OFFSET_MAX = 5;
// step 0.01, not 0.1: with alpha 0.05 a single update moves the offset by only
// a few hundredths, so a coarser step would round every update away to nothing.
const OFFSET_STEP = 0.01;

const ALPHA = 0.05;

const OLD_CHAIN = [
  "{% set primary_healthy = primary_battery > room_sensor_min_battery and primary_room is not none and not primary_stale %}",
  "{% set secondary_healthy = secondary_battery > room_sensor_min_battery and secondary_room is not none and not secondary_stale %}",
  "{% if primary_healthy %}",
  "  {% set candidate_source = 'primary_room_sensor' %}",
  "  {% set candidate = primary_room %}",
  "{% elif secondary_healthy %}",
  "  {% set candidate_source = 'secondary_room_sensor' %}",
  "  {% set candidate = secondary_room %}",
  "{% else %}",
  "  {% set candidate_source = 'climate_fallback' %}",
  "  {% set candidate = ac_temp %}",
  "{% endif %}",
  "{% set room_ac_conflict = candidate_source != 'climate_fallback' and ac_temp is not none and (candidate - ac_temp) | abs >= room_ac_disagreement_threshold %}",
].join("\n");

const NEW_CHAIN = [
  "{% set primary_healthy = primary_battery > room_sensor_min_battery and primary_room is not none and not primary_stale %}",
  "{% set secondary_healthy = secondary_battery > room_sensor_min_battery and secondary_room is not none and not secondary_stale %}",
  `{% set ac_stratification_offset = states('${AC_OFFSET}') | float(${AC_OFFSET_SEED}) %}`,
  `{% set secondary_stratification_offset = states('${SECONDARY_OFFSET}') | float(${SECONDARY_OFFSET_SEED}) %}`,
  "{% set ac_temp_occupied = none if ac_temp is none else (ac_temp - ac_stratification_offset) %}",
  "{% if primary_healthy %}",
  "  {% set candidate_source = 'primary_room_sensor' %}",
  "  {% set candidate = primary_room %}",
  "{% elif secondary_healthy %}",
  "  {% set candidate_source = 'secondary_room_sensor' %}",
  "  {% set candidate = secondary_room - secondary_stratification_offset %}",
  "{% else %}",
  "  {% set candidate_source = 'climate_fallback' %}",
  "  {% set candidate = ac_temp_occupied %}",
  "{% endif %}",
  "{% set room_ac_conflict = candidate_source != 'climate_fallback' and ac_temp_occupied is not none and (candidate - ac_temp_occupied) | abs >= room_ac_disagreement_threshold %}",
].join("\n");

const EXPECTED_CHAINS = 30;
const LEARN_ALIAS = "Learn stratification offsets against the occupied-level room sensor";

function transformStrings(node, fn) {
  if (typeof node === "string") return fn(node);
  if (Array.isArray(node)) return node.map((n) => transformStrings(n, fn));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = transformStrings(v, fn);
    return out;
  }
  return node;
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function collectStrings(node, acc = []) {
  if (typeof node === "string") acc.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, acc));
  else if (node && typeof node === "object") Object.values(node).forEach((n) => collectStrings(n, acc));
  return acc;
}

// The learning gate must agree with the resolver on what "healthy" means, so
// the preamble is lifted verbatim out of the automation's own templates rather
// than rewritten by hand - it cannot drift out of sync with what it gates.
function extractPreamble(config) {
  const template = collectStrings(config).find((s) => s.includes("candidate_source = 'climate_fallback'"));
  if (!template) throw new Error("no template carrying the sensor chain found");
  const lines = template.split("\n");
  const end = lines.findIndex((l) => l.startsWith("{% set secondary_healthy ="));
  if (end === -1) throw new Error("secondary_healthy not found in the chain template");
  const preamble = lines.slice(0, end + 1).join("\n");
  for (const needed of ["{% set ac_temp =", "{% set primary_room =", "{% set secondary_room =", "{% set primary_healthy ="]) {
    if (!preamble.includes(needed)) throw new Error(`extracted preamble is missing ${needed}`);
  }
  return preamble;
}

function emaTemplate(preamble, helper, seed, highReading) {
  return [
    preamble,
    `{% set old = states('${helper}') | float(${seed}) %}`,
    `{% set gap = ${highReading} - primary_room %}`,
    `{% set blended = old * ${1 - ALPHA} + gap * ${ALPHA} %}`,
    `{{ [[blended, ${OFFSET_MIN}] | max, ${OFFSET_MAX}] | min | round(2) }}`,
  ].join("\n");
}

function learningStep(preamble) {
  return {
    alias: LEARN_ALIAS,
    if: [{ condition: "template", value_template: `${preamble}\n{{ primary_healthy }}` }],
    then: [
      {
        if: [{ condition: "template", value_template: `${preamble}\n{{ ac_temp is not none }}` }],
        then: [
          {
            action: "input_number.set_value",
            target: { entity_id: AC_OFFSET },
            data: { value: emaTemplate(preamble, AC_OFFSET, AC_OFFSET_SEED, "ac_temp") },
          },
        ],
      },
      {
        if: [{ condition: "template", value_template: `${preamble}\n{{ secondary_room is not none }}` }],
        then: [
          {
            action: "input_number.set_value",
            target: { entity_id: SECONDARY_OFFSET },
            data: { value: emaTemplate(preamble, SECONDARY_OFFSET, SECONDARY_OFFSET_SEED, "secondary_room") },
          },
        ],
      },
    ],
  };
}

let wsSeq = 500;

// Deliberately no `initial`: none of this instance's 91 input_numbers set one,
// including the learned bedroomb_cooling_overshoot. `initial` would force the
// helper back to its seed on every HA restart, which for a LEARNED value means
// throwing away the calibration on each reboot. Without it the value is
// restored, and the seeding below only fires when there is nothing to restore.
async function ensureInputNumber(ws, entity, name, min, max, step, unit) {
  // HA derives the entity id from the friendly name on create, ignoring any id
  // we ask for. A mismatch here does not error at runtime - the templates just
  // read a non-existent entity and fall back to their `| float(...)` default,
  // so the offset silently freezes and never learns. Catch it up front.
  const derived = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const helperId = entity.replace(/^[^.]+\./, "");
  if (derived !== helperId) {
    throw new Error(`helper name "${name}" derives id "${derived}", but templates reference "${helperId}"`);
  }
  const list = await ws.request({ id: ++wsSeq, type: "input_number/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === helperId);
  const payload = { name, min, max, step, mode: "box", unit_of_measurement: unit, icon: "mdi:arrow-expand-vertical" };
  const res = existing
    ? await ws.request({ ...payload, id: ++wsSeq, type: "input_number/update", input_number_id: helperId })
    : await ws.request({ ...payload, id: ++wsSeq, type: "input_number/create" });
  if (!res.success) throw new Error(JSON.stringify(res));
  return Boolean(existing);
}

async function snapshot(label) {
  const states = await rest("/api/states", "GET");
  const by = Object.fromEntries(states.map((s) => [s.entity_id, s]));
  const climate = by[CLIMATE];
  const primary = Number(by[PRIMARY]?.state);
  const secondary = Number(by[SECONDARY]?.state);
  const acTemp = climate?.attributes?.current_temperature;
  const snap = {
    label,
    primary,
    secondary,
    ac_temp: acTemp,
    gap_ac_primary: Number((acTemp - primary).toFixed(2)),
    gap_secondary_primary: Number((secondary - primary).toFixed(2)),
    target: by["input_number.bedroomb_target_temperature"]?.state,
    threshold: by["input_number.bedroomb_room_ac_disagreement_threshold"]?.state,
    hvac_mode: climate?.state,
    fan_mode: climate?.attributes?.fan_mode,
    fan_boost_active: by["input_boolean.bedroomb_fan_boost_active"]?.state,
    ac_offset: by[AC_OFFSET]?.state ?? "(absent)",
    secondary_offset: by[SECONDARY_OFFSET]?.state ?? "(absent)",
  };
  console.log(JSON.stringify(snap, null, 2));
  return snap;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== BEFORE ===");
  const before = await snapshot("before");

  // Everything is validated before anything is created or written, so a failed
  // assertion leaves no orphaned helpers behind.
  const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
  const beforeRaw = JSON.stringify(config);

  const found = countOccurrences(beforeRaw, JSON.stringify(OLD_CHAIN).slice(1, -1));
  console.log(`\nsensor-resolution chains found: ${found}, expected ${EXPECTED_CHAINS}`);
  if (found !== EXPECTED_CHAINS) {
    throw new Error(`refusing to write: matched ${found} chains, expected ${EXPECTED_CHAINS}`);
  }

  const preamble = extractPreamble(config);
  console.log(`extracted primary_healthy preamble: ${preamble.split("\n").length} lines, ${preamble.length} chars`);

  let patched = transformStrings(config, (s) => s.split(OLD_CHAIN).join(NEW_CHAIN));

  const actions = patched.actions || patched.action;
  if (!Array.isArray(actions)) throw new Error("automation has no actions array");
  if (actions.some((a) => a.alias === LEARN_ALIAS)) {
    throw new Error("refusing to write: learning step already present");
  }
  const beforeSteps = actions.length;
  patched = { ...patched, actions: [learningStep(preamble), ...actions] };
  console.log(`action steps: ${beforeSteps} -> ${patched.actions.length}`);

  const afterRaw = JSON.stringify(patched);
  const residual = {
    raw_fallback: countOccurrences(afterRaw, JSON.stringify("  {% set candidate = ac_temp %}").slice(1, -1)),
    raw_secondary: countOccurrences(afterRaw, JSON.stringify("  {% set candidate = secondary_room %}").slice(1, -1)),
    raw_conflict: countOccurrences(afterRaw, "(candidate - ac_temp) | abs"),
  };
  console.log("residual raw-frame patterns (must all be 0):", JSON.stringify(residual));
  if (Object.values(residual).some((v) => v !== 0)) {
    throw new Error("refusing to write: raw-frame comparisons remain");
  }
  // 4 per chain: the definition, the fallback assignment, and twice in the
  // conflict predicate (none-guard and the difference).
  const normalised = countOccurrences(afterRaw, "ac_temp_occupied");
  console.log(`ac_temp_occupied occurrences: ${normalised} (expect ${EXPECTED_CHAINS * 4})`);
  if (normalised !== EXPECTED_CHAINS * 4) {
    throw new Error(`refusing to write: expected ${EXPECTED_CHAINS * 4} ac_temp_occupied uses, found ${normalised}`);
  }
  // dynamic_setpoint must keep consuming the unit's own reference frame.
  const setpointRaw = countOccurrences(afterRaw, "((ac_temp - error) * 2) | round(0) / 2");
  const setpointBefore = countOccurrences(beforeRaw, "((ac_temp - error) * 2) | round(0) / 2");
  console.log(`dynamic_setpoint on raw ac_temp: ${setpointBefore} -> ${setpointRaw} (must be unchanged)`);
  if (setpointRaw !== setpointBefore || setpointRaw === 0) {
    throw new Error("refusing to write: dynamic_setpoint no longer derives from raw ac_temp");
  }
  if (afterRaw === beforeRaw) throw new Error("refusing to write: config unchanged");

  if (dryRun) {
    console.log("\n--dry-run: all assertions passed, nothing written");
    return;
  }

  const ws = await connectWs();
  const acExisted = await ensureInputNumber(
    ws, AC_OFFSET, AC_OFFSET_NAME, OFFSET_MIN, OFFSET_MAX, OFFSET_STEP, "°C",
  );
  const secExisted = await ensureInputNumber(
    ws, SECONDARY_OFFSET, SECONDARY_OFFSET_NAME, OFFSET_MIN, OFFSET_MAX, OFFSET_STEP, "°C",
  );
  ws.close();
  console.log(`\nhelpers: ${AC_OFFSET} ${acExisted ? "updated" : "created"}, ${SECONDARY_OFFSET} ${secExisted ? "updated" : "created"}`);

  // Seed only when there is nothing worth keeping, so a re-run never discards
  // what the EMA has already learned. A freshly created input_number with no
  // `initial` comes up sitting on its own min (-3), which is a perfectly finite
  // number and not a value - hence keying on whether the helper pre-existed
  // rather than on whether its state parses.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const seedStates = await rest("/api/states", "GET");
  for (const [entity, seed, existed] of [
    [AC_OFFSET, AC_OFFSET_SEED, acExisted],
    [SECONDARY_OFFSET, SECONDARY_OFFSET_SEED, secExisted],
  ]) {
    const current = seedStates.find((s) => s.entity_id === entity);
    const value = Number(current?.state);
    const keep = existed && Number.isFinite(value) && value !== OFFSET_MIN;
    if (keep) {
      console.log(`${entity} already at ${current.state}, left alone`);
    } else {
      await rest("/api/services/input_number/set_value", "POST", { entity_id: entity, value: seed });
      console.log(`seeded ${entity} = ${seed} (was ${current ? current.state : "absent"})`);
    }
  }

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/trigger", "POST", { entity_id: AUTOMATION_ENTITY });

  await new Promise((resolve) => setTimeout(resolve, 6000));

  console.log("\n=== AFTER ===");
  const after = await snapshot("after");

  console.log("\n=== DELTA ===");
  console.log(JSON.stringify({
    ac_offset: `${before.ac_offset} -> ${after.ac_offset}`,
    secondary_offset: `${before.secondary_offset} -> ${after.secondary_offset}`,
    hvac_mode: `${before.hvac_mode} -> ${after.hvac_mode}`,
    fan_mode: `${before.fan_mode} -> ${after.fan_mode}`,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
