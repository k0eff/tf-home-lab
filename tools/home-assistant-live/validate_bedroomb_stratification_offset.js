// Validation for eval 015 - BedroomB stratification-offset normalisation.
//
// Behavioural checks render the OLD and NEW predicates against explicit literal
// inputs rather than live state, so they stay reproducible after the room has
// drifted; structural checks read the live config and main.tf.
//
// Run: HA_BASE=... HA_TOKEN=... node validate_bedroomb_stratification_offset.js

const fs = require("fs");
const http = require("http");
const path = require("path");
const { rest } = require("./ha_ws_util");

// /api/template answers in plain text, which ha_ws_util's rest() would try to
// JSON.parse.
function restText(p, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, (process.env.HA_BASE || "").replace(/\/$/, ""));
    const body = JSON.stringify(payload);
    const req = http.request(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HA_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => (res.statusCode >= 200 && res.statusCode < 300
        ? resolve(data)
        : reject(new Error(`${res.statusCode}: ${data.slice(0, 300)}`))));
    });
    req.on("error", reject);
    req.end(body);
  });
}

const AUTOMATION_ID = "1770077000021";
const AUTOMATION_ENTITY = "automation.test_aircon_bedroomb_room_sensor_comfort_band";
const SIBLINGS = { livingr: "1770077000010", bedrooms: "1770077000061" };
const AC_OFFSET = "input_number.bedroomb_ac_stratification_offset";
const CEILING_OFFSET = "input_number.bedroomb_ceiling_sensor_stratification_offset";
const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");
const RESOURCE = 'resource "homeassistant_automation" "test_aircon_bedroomb_room_sensor_comfort_band" {';

// The measured incident conditions: occupied level 24.7, ceiling 26.1, AC
// return air 26.0, learned offsets 1.2 / 1.3, disagreement threshold 1.0.
const LIT = {
  primary_room: 24.7,
  secondary_room: 26.1,
  ac_temp: 26.0,
  ac_stratification_offset: 1.2,
  secondary_stratification_offset: 1.3,
  room_ac_disagreement_threshold: 1.0,
};

const OLD_CONFLICT = "{{ (candidate - ac_temp) | abs >= room_ac_disagreement_threshold }}";
const NEW_CONFLICT =
  "{% set ac_temp_occupied = none if ac_temp is none else (ac_temp - ac_stratification_offset) %}\n" +
  "{{ (candidate - ac_temp_occupied) | abs >= room_ac_disagreement_threshold }}";

// `| float | round(2)` so the literal is compared as a temperature, not as
// whatever JSON number formatting the preamble happened to emit (26.0 -> 26).
const OLD_FALLBACK = "{{ ac_temp | float | round(2) }}";
const NEW_FALLBACK = "{{ (ac_temp - ac_stratification_offset) | round(2) }}";
const OLD_SECONDARY = "{{ secondary_room }}";
const NEW_SECONDARY = "{{ (secondary_room - secondary_stratification_offset) | round(2) }}";

const EMA = (start, gap, iterations) =>
  `{% set ns = namespace(v = ${start}) %}` +
  `{% for i in range(${iterations}) %}` +
  `{% set ns.v = [[ns.v * 0.95 + (${gap}) * 0.05, -3] | max, 5] | min %}` +
  "{% endfor %}" +
  "{{ ns.v | round(2) }}";

function preamble(vars) {
  return Object.entries(vars)
    .map(([k, v]) => `{% set ${k} = ${typeof v === "string" ? `'${v}'` : v} %}`)
    .join("\n");
}

async function render(template, vars = {}) {
  const out = await restText("/api/template", { template: `${preamble(vars)}\n${template}` });
  return String(out).trim();
}

const results = [];
function check(id, description, actual, expected) {
  const pass = String(actual) === String(expected);
  results.push({ id, pass, description });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}  ${description}\n       got=${actual} want=${expected}`);
}

async function main() {
  // C1 - live capture, and the gaps that motivate the whole change
  const states = await rest("/api/states", "GET");
  const by = Object.fromEntries(states.map((s) => [s.entity_id, s]));
  const primary = Number(by["sensor.miaomiaoce_t2_5249_temperature"].state);
  const secondary = Number(by["sensor.miaomiaoce_t2_faea_temperature"].state);
  const acTemp = by["climate.v357_spalniag_2"].attributes.current_temperature;
  console.log("=== C1 LIVE ===");
  console.log(JSON.stringify({
    primary, secondary, ac_temp: acTemp,
    gap_ac_primary: Number((acTemp - primary).toFixed(2)),
    gap_secondary_primary: Number((secondary - primary).toFixed(2)),
    ac_offset: by[AC_OFFSET]?.state,
    ceiling_offset: by[CEILING_OFFSET]?.state,
    threshold: by["input_number.bedroomb_room_ac_disagreement_threshold"]?.state,
    target: by["input_number.bedroomb_target_temperature"]?.state,
    hvac: by["climate.v357_spalniag_2"].state,
    fan: by["climate.v357_spalniag_2"].attributes.fan_mode,
  }, null, 2));
  check("C1", "both learned offsets exist and are finite",
    Number.isFinite(Number(by[AC_OFFSET]?.state)) && Number.isFinite(Number(by[CEILING_OFFSET]?.state)), "true");

  // C2 - the conflict detector was firing on plain stratification
  const conflictVars = { ...LIT, candidate: LIT.primary_room };
  check("C2a", "OLD conflict fired on an ordinary 1.3C stratification gap - the defect",
    await render(OLD_CONFLICT, conflictVars), "True");
  check("C2b", "NEW conflict does not fire once both sides are in the same frame",
    await render(NEW_CONFLICT, conflictVars), "False");

  // C3 - narrowed, not disabled: a genuine sensor disagreement still trips it
  check("C3a", "NEW conflict still fires when the room sensor really disagrees (primary stuck 1.5C low)",
    await render(NEW_CONFLICT, { ...conflictVars, candidate: LIT.primary_room - 1.5 }), "True");
  check("C3b", "NEW conflict still fires the other way (primary stuck 1.5C high)",
    await render(NEW_CONFLICT, { ...conflictVars, candidate: LIT.primary_room + 1.5 }), "True");
  check("C3c", "NEW conflict quiet just inside the threshold",
    await render(NEW_CONFLICT, { ...conflictVars, candidate: LIT.ac_temp - LIT.ac_stratification_offset + 0.9 }), "False");

  // C4/C5 - fallback paths no longer substitute a ceiling reading for a room one
  check("C4a", "OLD climate_fallback handed the comfort band the raw ceiling reading",
    await render(OLD_FALLBACK, LIT), "26.0");
  check("C4b", "NEW climate_fallback hands it the occupied-level equivalent",
    await render(NEW_FALLBACK, LIT), "24.8");
  check("C4c", "the correction equals exactly the learned AC offset",
    await render("{{ (ac_temp - (ac_temp - ac_stratification_offset)) | round(2) }}", LIT), "1.2");
  check("C5a", "OLD secondary branch handed over the raw ceiling reading",
    await render(OLD_SECONDARY, LIT), "26.1");
  check("C5b", "NEW secondary branch normalises it to occupied level",
    await render(NEW_SECONDARY, LIT), "24.8");

  // C8 - the EMA is a contraction: converges on the true gap, never escapes the clamp
  check("C8a", "EMA converges from the seed onto a persistent 2.0C gap",
    await render(EMA(1.2, 2.0, 400)), "2.0");
  check("C8b", "EMA converges downward just as well",
    await render(EMA(1.2, 0.1, 400)), "0.1");
  check("C8c", "EMA clamps at the top against an absurd gap",
    await render(EMA(1.2, 40, 400)), "5.0");
  check("C8d", "EMA clamps at the bottom against an absurd negative gap",
    await render(EMA(1.2, -40, 400)), "-3.0");
  check("C8e", "a single update moves only a few hundredths, so 0.01 step is required to move at all",
    await render(EMA(1.2, 2.0, 1)), "1.24");

  // C7 - helper shape
  const acHelper = by[AC_OFFSET];
  const ceilHelper = by[CEILING_OFFSET];
  check("C7a", "AC offset helper has step 0.01 (coarser rounds every EMA update away)",
    acHelper?.attributes?.step, "0.01");
  check("C7b", "ceiling offset helper has step 0.01", ceilHelper?.attributes?.step, "0.01");
  check("C7c", "AC offset helper clamped to [-3, 5]",
    `${acHelper?.attributes?.min},${acHelper?.attributes?.max}`, "-3,5");
  check("C7d", "ceiling offset helper clamped to [-3, 5]",
    `${ceilHelper?.attributes?.min},${ceilHelper?.attributes?.max}`, "-3,5");

  // C6/C9 - structural checks on the live config
  const cfg = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
  const raw = JSON.stringify(cfg);
  const c = (n) => raw.split(n).length - 1;
  check("C9a", "all 30 sensor chains normalised", c("ac_temp_occupied"), 120);
  check("C9b", "all 30 secondary branches normalised", c("secondary_room - secondary_stratification_offset"), 30);
  check("C9c", "no raw-frame conflict comparison left", c("(candidate - ac_temp) | abs"), 0);
  check("C9d", "no raw ceiling reading substituted in the fallback", c("{% set candidate = ac_temp %}"), 0);
  check("C9e", "no raw ceiling reading substituted in the secondary branch", c("{% set candidate = secondary_room %}"), 0);
  check("C9f", "no dangling reference to the id HA never assigned",
    c("input_number.bedroomb_secondary_stratification_offset"), 0);
  check("C6", "dynamic_setpoint still derives from RAW ac_temp - the unit's own frame",
    c("((ac_temp - error) * 2) | round(0) / 2"), 30);
  check("C9g", "learning step present exactly once",
    (cfg.actions || []).filter((a) => a.alias === "Learn stratification offsets against the occupied-level room sensor").length, 1);
  check("C9h", "learning step runs first, ahead of the boost latch and the comfort choose",
    (cfg.actions || [])[0]?.alias, "Learn stratification offsets against the occupied-level room sensor");
  // eval 014 must survive untouched
  check("C9i", "eval-014 season-aware boost still in place", c("set boost_error"), 2);
  check("C9j", "no eval-014 abs() regression", c("(error | abs)"), 0);
  check("C9k", "no eval-014 deadlock clause regression", c("== (cooling_fan_mode | string) and "), 0);

  // C10 - scope containment
  for (const [name, id] of Object.entries(SIBLINGS)) {
    const sib = JSON.stringify(await rest(`/api/config/automation/config/${id}`, "GET"));
    check(`C10-${name}`, `${name} deliberately untouched by this slice`,
      sib.split("ac_temp_occupied").length - 1, 0);
  }

  // C11 - healthy, and actually learning
  check("C11a", "automation enabled after reload", by[AUTOMATION_ENTITY]?.state, "on");
  const acBefore = Number(by[AC_OFFSET].state);
  const ceilBefore = Number(by[CEILING_OFFSET].state);
  await rest("/api/services/automation/trigger", "POST", { entity_id: AUTOMATION_ENTITY });
  await new Promise((r) => setTimeout(r, 6000));
  const after = await rest("/api/states", "GET");
  const byAfter = Object.fromEntries(after.map((s) => [s.entity_id, s]));
  const acAfter = Number(byAfter[AC_OFFSET].state);
  const ceilAfter = Number(byAfter[CEILING_OFFSET].state);
  const primaryNow = Number(byAfter["sensor.miaomiaoce_t2_5249_temperature"].state);
  const acNow = byAfter["climate.v357_spalniag_2"].attributes.current_temperature;
  const ceilNow = Number(byAfter["sensor.miaomiaoce_t2_faea_temperature"].state);
  console.log(`\nlearning step: ac ${acBefore} -> ${acAfter} (live gap ${(acNow - primaryNow).toFixed(2)}), ` +
    `ceiling ${ceilBefore} -> ${ceilAfter} (live gap ${(ceilNow - primaryNow).toFixed(2)})`);
  // Each offset must move toward the live gap, or already be sitting on it.
  const moved = (before, afterVal, gap) =>
    Math.abs(afterVal - gap) <= Math.abs(before - gap) + 1e-9;
  check("C11b", "AC offset moved toward (or stayed at) the live gap", moved(acBefore, acAfter, acNow - primaryNow), "true");
  check("C11c", "ceiling offset moved toward (or stayed at) the live gap", moved(ceilBefore, ceilAfter, ceilNow - primaryNow), "true");

  // C12 - main.tf mirrors the live config
  if (fs.existsSync(MAIN_TF)) {
    const tf = fs.readFileSync(MAIN_TF, "utf8");
    const start = tf.indexOf(RESOURCE);
    let block = "";
    if (start !== -1) {
      const open = tf.indexOf("{", start);
      let depth = 0;
      let i = open;
      for (; i < tf.length; i += 1) {
        if (tf[i] === "{") depth += 1;
        else if (tf[i] === "}") { depth -= 1; if (depth === 0) break; }
      }
      block = tf.slice(open, i + 1);
    }
    const t = (n) => block.split(n).length - 1;
    check("C12a", "main.tf BedroomB block carries all 30 normalised chains", t("ac_temp_occupied"), 120);
    check("C12b", "main.tf has no raw-frame conflict comparison", t("(candidate - ac_temp) | abs"), 0);
    check("C12c", "main.tf keeps dynamic_setpoint on raw ac_temp", t("((ac_temp - error) * 2) | round(0) / 2"), 30);
    check("C12d", "main.tf carries the learning step", t("Learn stratification offsets against the occupied-level room sensor") > 0, "true");
    check("C12e", "main.tf has no dangling helper reference", t("input_number.bedroomb_secondary_stratification_offset"), 0);
  } else {
    console.log("SKIP C12 - main.tf not found");
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
