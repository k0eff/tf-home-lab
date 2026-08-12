// Incident 2026-08-06: BedroomB (climate.v357_spalniag_2) held fan speed 5
// while the occupied-level room sensor sat at 23.7C against a 24.4C target -
// i.e. the room was already 0.7C COLDER than it was aiming for, and the unit
// was still blowing at boost speed. Reported as "super cold and it runs at max".
//
// Two independent defects, both of which had to go for the symptom to clear.
//
// (1) The fan-boost latch shipped in eval 006 keys off `(error | abs)`:
//        ON:  (error | abs) >= fan_boost_threshold
//        OFF: (error | abs) <  fan_boost_threshold - fan_boost_effective_margin
//     Eval 006 chose absolute value deliberately and documented the intent as
//     "symmetric for summer overshoot and winter undershoot". The intent was
//     right; absolute value is the wrong encoding of it. abs() is season-blind,
//     so each season also fires on its own COMFORTABLE side: in summer a room
//     that has overcooled to error=-1.0 latches the boost just as hard as one
//     that has overheated to +1.0. At the observed error of -0.7 the release
//     band (|error| < 0.5) could not be reached either, so the latch was held
//     open by the very coldness it should have been standing down for.
//     Fix: boost_error = error in summer, -error in winter. Boost now latches
//     only on the uncomfortable side of target, in both seasons. The release
//     leg also releases when boost_error is none, so the latch cannot strand.
//
// (2) The room/AC disagreement resolver picked
//        conflict_worst_case = max(room, ac_temp)  (summer)
//     whenever the two readings differed by >= the disagreement threshold.
//     That is not a fault-tolerance win here: `ac_temp` is the unit's own
//     return-air sensor up at the ceiling, and the CEILING room sensor (faea,
//     25.7C) agrees closely with it while the occupied-level sensor (5249,
//     23.7C) reads ~2C lower. The "conflict" is ordinary thermal
//     stratification, so worst-case resolution controls the room to its
//     ceiling temperature and overcools the occupied zone by exactly the
//     stratification gap - by design, every time.
//     Fix: trust the healthy room sensor. The distinct `source` label is kept
//     (renamed, not deleted) so the disagreement still shows up in the
//     logbook message as a diagnostic.
//
// (3) Lowers input_number.bedroomb_room_ac_disagreement_threshold 1.5 -> 1.0
//     as requested. Note this is only safe AFTER (2): at the live readings
//     (23.7 vs 25.5, diff 1.8) the old resolver would have taken 25.5 as
//     effective, yielding error=+1.1 and commanding cooling against an
//     already-cold room. Lowering the threshold against the old resolver
//     would have made the reported symptom strictly worse.
//
// Scope is BedroomB only. LivingR (1770077000010) and BedroomS (1770077000031)
// carry both defects identically and are deliberately left for a separate
// slice. Applied directly via REST against the live automation config, same
// pattern as the other live fixes here; main.tf is mirrored separately.

const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000021";
const AUTOMATION_ENTITY = "automation.test_aircon_bedroomb_room_sensor_comfort_band";
const THRESHOLD_ENTITY = "input_number.bedroomb_room_ac_disagreement_threshold";
const NEW_THRESHOLD = 1.0;

const BOOST_ERROR_DEF =
  "{% set boost_error = none if error is none else (error if climate_mode == 'summer' else (0 - error)) %}\n";

const REPLACEMENTS = [
  // (1) fan-boost latch: absolute error -> season-aware error
  {
    label: "latch ON condition",
    from: "{{ error is not none and (error | abs) >= fan_boost_threshold }}",
    to:
      BOOST_ERROR_DEF +
      "{{ boost_error is not none and boost_error >= fan_boost_threshold }}",
  },
  {
    label: "latch RELEASE condition",
    from:
      "{{ is_state('input_boolean.bedroomb_fan_boost_active', 'on') and error is not none and (error | abs) < (fan_boost_threshold - fan_boost_effective_margin) }}",
    to:
      BOOST_ERROR_DEF +
      "{{ is_state('input_boolean.bedroomb_fan_boost_active', 'on') and (boost_error is none or boost_error < (fan_boost_threshold - fan_boost_effective_margin)) }}",
  },
  // (2) disagreement resolver: worst case -> trust the healthy room sensor
  {
    label: "room/AC disagreement resolver",
    from:
      "{% if room_ac_conflict %}\n" +
      "  {% set source = 'conflict_worst_case' %}\n" +
      "  {% set effective = ([candidate, ac_temp] | max) if climate_mode == 'summer' else ([candidate, ac_temp] | min) if climate_mode == 'winter' else candidate %}\n" +
      "{% else %}",
    to:
      "{% if room_ac_conflict %}\n" +
      "  {% set source = 'conflict_trust_room_sensor' %}\n" +
      "  {% set effective = candidate %}\n" +
      "{% else %}",
  },
];

// Walk every string leaf in the config so the patch applies uniformly to
// condition templates, action data templates and the logbook message alike.
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

async function snapshot(label) {
  const states = await rest("/api/states", "GET");
  const by = Object.fromEntries(states.map((s) => [s.entity_id, s]));
  const climate = by["climate.v357_spalniag_2"];
  const snap = {
    label,
    primary_room: by["sensor.miaomiaoce_t2_5249_temperature"]?.state,
    secondary_room: by["sensor.miaomiaoce_t2_faea_temperature"]?.state,
    ac_temp: climate?.attributes?.current_temperature,
    target: by["input_number.bedroomb_target_temperature"]?.state,
    hvac_mode: climate?.state,
    fan_mode: climate?.attributes?.fan_mode,
    fan_boost_active: by["input_boolean.bedroomb_fan_boost_active"]?.state,
    configured_cooling_fan_mode: by["input_number.bedroomb_cooling_fan_mode"]?.state,
    disagreement_threshold: by[THRESHOLD_ENTITY]?.state,
  };
  console.log(JSON.stringify(snap, null, 2));
  return snap;
}

async function main() {
  console.log("=== BEFORE ===");
  const before = await snapshot("before");

  const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
  const beforeRaw = JSON.stringify(config);

  const counts = {};
  const patched = transformStrings(config, (s) => {
    let out = s;
    for (const r of REPLACEMENTS) {
      const n = countOccurrences(out, r.from);
      if (n > 0) {
        counts[r.label] = (counts[r.label] || 0) + n;
        out = out.split(r.from).join(r.to);
      }
    }
    return out;
  });

  console.log("\n=== REPLACEMENTS APPLIED ===");
  console.log(JSON.stringify(counts, null, 2));

  for (const r of REPLACEMENTS) {
    if (!counts[r.label]) {
      throw new Error(`refusing to write: no occurrence matched for "${r.label}"`);
    }
  }

  const afterRaw = JSON.stringify(patched);
  const residual = {
    "(error | abs)": countOccurrences(afterRaw, "(error | abs)"),
    conflict_worst_case: countOccurrences(afterRaw, "conflict_worst_case"),
  };
  console.log("\n=== RESIDUAL OLD PATTERNS (must be 0) ===");
  console.log(JSON.stringify(residual, null, 2));
  if (residual["(error | abs)"] !== 0 || residual.conflict_worst_case !== 0) {
    throw new Error("refusing to write: old patterns still present after patch");
  }
  if (afterRaw === beforeRaw) throw new Error("refusing to write: config unchanged");

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
  await rest("/api/services/input_number/set_value", "POST", {
    entity_id: THRESHOLD_ENTITY,
    value: NEW_THRESHOLD,
  });
  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/trigger", "POST", { entity_id: AUTOMATION_ENTITY });

  await new Promise((resolve) => setTimeout(resolve, 4000));

  console.log("\n=== AFTER ===");
  const after = await snapshot("after");

  console.log("\n=== DELTA ===");
  console.log(
    JSON.stringify(
      {
        fan_boost_active: `${before.fan_boost_active} -> ${after.fan_boost_active}`,
        fan_mode: `${before.fan_mode} -> ${after.fan_mode}`,
        hvac_mode: `${before.hvac_mode} -> ${after.hvac_mode}`,
        disagreement_threshold: `${before.disagreement_threshold} -> ${after.disagreement_threshold}`,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
