// Mirrors the eval-015 live changes into main.tf so a future `terraform apply`
// cannot revert them:
//   apply_bedroomb_stratification_offset.js        (chain normalisation + learner)
//   fix_bedroomb_secondary_offset_entity_id.js     (helper entity id repair)
//
// Two shape differences between the live JSON and main.tf are handled here:
//
//   1. main.tf stores each multi-line Jinja template as ONE physical HCL line
//      with literal 2-char "\n" sequences rather than real newline bytes, so
//      the live-oriented replacement strings need re-expressing with "\\n".
//   2. main.tf writes service calls as "service" = "..."; HA normalises those
//      to "action" on read. The learning step is emitted in the file's own
//      style, which is why it is written out here rather than copied verbatim
//      from the live config.
//
// Scoped by brace-matching the BedroomB resource block, because the sensor
// chain is byte-identical across all three rooms and a whole-file replace would
// silently patch LivingR and BedroomS, which this slice leaves alone.
//
// The helpers themselves are not in main.tf - this instance has no
// homeassistant_input_number resources at all, all 91 helpers are created over
// the websocket API. apply_bedroomb_stratification_offset.js remains their
// source of truth.
//
// One-off; asserts its expected counts and refuses to write if they do not hold.
//
// Run: node backport_bedroomb_stratification_offset_terraform.js

const fs = require("fs");
const path = require("path");

const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");
const RESOURCE = 'resource "homeassistant_automation" "test_aircon_bedroomb_room_sensor_comfort_band" {';
const AUTOMATION_ID = "1770077000021";

const NL = "\\n"; // literal backslash-n, as stored inside main.tf's HCL strings
const AC_OFFSET = "input_number.bedroomb_ac_stratification_offset";
const CEILING_OFFSET = "input_number.bedroomb_ceiling_sensor_stratification_offset";
const EXPECTED_CHAINS = 30;
const LEARN_ALIAS = "Learn stratification offsets against the occupied-level room sensor";

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
].join(NL);

const NEW_CHAIN = [
  "{% set primary_healthy = primary_battery > room_sensor_min_battery and primary_room is not none and not primary_stale %}",
  "{% set secondary_healthy = secondary_battery > room_sensor_min_battery and secondary_room is not none and not secondary_stale %}",
  `{% set ac_stratification_offset = states('${AC_OFFSET}') | float(1.2) %}`,
  `{% set secondary_stratification_offset = states('${CEILING_OFFSET}') | float(1.3) %}`,
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
].join(NL);

// HCL quoted strings share JSON's escapes for \n, \t, \" and \\, so
// JSON.stringify produces a valid HCL literal - provided the text contains no
// HCL template-interpolation opener. Jinja never emits either, but assert it
// rather than assume it.
function hclString(text) {
  if (text.includes("${") || text.includes("%{")) {
    throw new Error("text contains an HCL interpolation opener and needs $${ / %%{ escaping");
  }
  // eval 016: this function takes RAW text and produces an HCL literal. If the
  // caller hands it text that is already HCL-escaped - which anything lifted out
  // of main.tf is, since main.tf stores each template as one physical line with
  // 2-character \n sequences - then JSON.stringify escapes the backslash again
  // and the literal lands as \\n, which terraform parses as backslash + n rather
  // than a newline. That is silent: counts, greps and presence checks all still
  // pass over the corrupted template. Unescape before calling, not after.
  if (/\\n/.test(text)) {
    throw new Error("text still contains a 2-character \\n sequence - it is HCL-escaped already; unescape it to real newlines before calling hclString");
  }
  return JSON.stringify(text);
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function structural(src) {
  const counts = { "{": 0, "}": 0, "[": 0, "]": 0, "(": 0, ")": 0 };
  for (const ch of src) if (ch in counts) counts[ch] += 1;
  return counts;
}

function resourceBlock(text) {
  const start = text.indexOf(RESOURCE);
  if (start === -1) throw new Error("BedroomB resource not found in main.tf");
  const open = text.indexOf("{", start);
  let depth = 0;
  let i = open;
  for (; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error("unbalanced braces while scoping the BedroomB resource");
  return { open, close: i + 1 };
}

// The learning gate must agree with the resolver on what "healthy" means, so
// the preamble is lifted out of main.tf's own templates rather than rewritten.
function extractPreamble(block) {
  const marker = "{% set primary_room = states(";
  const at = block.indexOf(marker);
  if (at === -1) throw new Error("no template preamble found in the BedroomB block");
  const endMarker = "{% set secondary_healthy = ";
  const endAt = block.indexOf(endMarker, at);
  if (endAt === -1) throw new Error("secondary_healthy not found after the preamble start");
  const tail = block.indexOf(NL, endAt);
  const preamble = block.slice(at, tail);
  for (const needed of ["{% set ac_temp =", "{% set secondary_room =", "{% set primary_healthy ="]) {
    if (!preamble.includes(needed)) throw new Error(`extracted preamble is missing ${needed}`);
  }
  return preamble; // already in main.tf's literal-\n form
}

function emaTemplate(preamble, helper, seed, highReading) {
  return [
    preamble,
    `{% set old = states('${helper}') | float(${seed}) %}`,
    `{% set gap = ${highReading} - primary_room %}`,
    "{% set blended = old * 0.95 + gap * 0.05 %}",
    "{{ [[blended, -3] | max, 5] | min | round(2) }}",
  ].join(NL);
}

function learningStepHcl(preamble) {
  const setter = (helper, seed, reading, guard) => `        {
          "if" = [
            {
              "condition" = "template"
              "value_template" = ${hclString(`${preamble}${NL}{{ ${guard} }}`)}
            }
          ]
          "then" = [
            {
              "service" = "input_number.set_value"
              "target" = {
                "entity_id" = "${helper}"
              }
              "data" = {
                "value" = ${hclString(emaTemplate(preamble, helper, seed, reading))}
              }
            }
          ]
        }`;
  return `    {
      "alias" = "${LEARN_ALIAS}"
      "if" = [
        {
          "condition" = "template"
          "value_template" = ${hclString(`${preamble}${NL}{{ primary_healthy }}`)}
        }
      ]
      "then" = [
${setter(AC_OFFSET, 1.2, "ac_temp", "ac_temp is not none")},
${setter(CEILING_OFFSET, 1.3, "secondary_room", "secondary_room is not none")}
      ]
    },
`;
}

function main() {
  const original = fs.readFileSync(MAIN_TF, "utf8");
  const { open, close } = resourceBlock(original);
  let block = original.slice(open, close);
  if (!block.includes(`"id" = "${AUTOMATION_ID}"`) && !block.includes(AUTOMATION_ID)) {
    console.log(`note: automation id ${AUTOMATION_ID} not literal in the block (managed by provider)`);
  }
  const beforeStructural = structural(original);

  const found = countOccurrences(block, OLD_CHAIN);
  console.log(`sensor-resolution chains: found ${found}, expected ${EXPECTED_CHAINS}`);
  if (found !== EXPECTED_CHAINS) {
    throw new Error(`refusing to write: matched ${found} chains, expected ${EXPECTED_CHAINS}`);
  }

  const preamble = extractPreamble(block);
  console.log(`extracted preamble: ${preamble.length} chars, ${countOccurrences(preamble, NL) + 1} template lines`);

  block = block.split(OLD_CHAIN).join(NEW_CHAIN);

  const anchor = "action = jsonencode([\n";
  const anchorAt = block.indexOf(anchor);
  if (anchorAt === -1) throw new Error("action = jsonencode([ anchor not found");
  if (block.includes(LEARN_ALIAS)) throw new Error("refusing to write: learning step already present");
  const stepHcl = learningStepHcl(preamble);
  block = block.slice(0, anchorAt + anchor.length) + stepHcl + block.slice(anchorAt + anchor.length);

  const patched = original.slice(0, open) + block + original.slice(close);

  const residual = {
    raw_conflict: countOccurrences(block, "(candidate - ac_temp) | abs"),
    raw_fallback: countOccurrences(block, "{% set candidate = ac_temp %}"),
    raw_secondary: countOccurrences(block, "{% set candidate = secondary_room %}"),
    dangling_helper: countOccurrences(block, "input_number.bedroomb_secondary_stratification_offset"),
  };
  console.log("residual inside the BedroomB block:", JSON.stringify(residual));
  if (Object.values(residual).some((v) => v !== 0)) {
    throw new Error("refusing to write: raw-frame comparisons or dangling helper references remain");
  }
  const normalised = countOccurrences(block, "ac_temp_occupied");
  console.log(`ac_temp_occupied: ${normalised} (expect ${EXPECTED_CHAINS * 4})`);
  if (normalised !== EXPECTED_CHAINS * 4) {
    throw new Error(`refusing to write: expected ${EXPECTED_CHAINS * 4} ac_temp_occupied uses, found ${normalised}`);
  }
  const setpoint = countOccurrences(block, "((ac_temp - error) * 2) | round(0) / 2");
  console.log(`dynamic_setpoint on raw ac_temp: ${setpoint} (must stay ${EXPECTED_CHAINS})`);
  if (setpoint !== EXPECTED_CHAINS) {
    throw new Error("refusing to write: dynamic_setpoint no longer derives from raw ac_temp");
  }
  if (countOccurrences(block, LEARN_ALIAS) !== 1) {
    throw new Error("refusing to write: learning step not inserted exactly once");
  }

  // Scope containment, checked exactly rather than by proxy: everything outside
  // the BedroomB block must be byte-identical. (A count-based sibling check is
  // no good here - LivingR drives a single room sensor and BedroomS words its
  // chain differently, so neither carries this byte-identical chain to count.)
  if (patched.slice(0, open) !== original.slice(0, open)) {
    throw new Error("refusing to write: content before the BedroomB block changed");
  }
  if (patched.slice(open + block.length) !== original.slice(close)) {
    throw new Error("refusing to write: content after the BedroomB block changed");
  }
  const siblingNormalised = countOccurrences(patched, "ac_temp_occupied") - normalised;
  console.log(`outside BedroomB: ac_temp_occupied=${siblingNormalised} (byte-identical to the original)`);
  if (siblingNormalised !== 0) {
    throw new Error("refusing to write: normalisation leaked outside the BedroomB block");
  }

  // Structural delta derived from the replacement definitions themselves, not
  // read back off the patched file.
  const afterStructural = structural(patched);
  const delta = Object.fromEntries(
    Object.keys(beforeStructural).map((k) => [k, afterStructural[k] - beforeStructural[k]]),
  );
  const chainOld = structural(OLD_CHAIN);
  const chainNew = structural(NEW_CHAIN);
  const inserted = structural(stepHcl);
  const expectedDelta = Object.fromEntries(
    Object.keys(beforeStructural).map((k) => [
      k,
      EXPECTED_CHAINS * (chainNew[k] - chainOld[k]) + inserted[k],
    ]),
  );
  console.log("structural delta:", JSON.stringify(delta));
  console.log("expected        :", JSON.stringify(expectedDelta));
  for (const k of Object.keys(expectedDelta)) {
    if (delta[k] !== expectedDelta[k]) {
      throw new Error(`structural delta mismatch for "${k}": got ${delta[k]}, expected ${expectedDelta[k]}`);
    }
  }

  fs.writeFileSync(MAIN_TF, patched);
  console.log("main.tf written");
  console.log("now run: terraform fmt -check -diff | wc -l  (baseline 4237, and a non-zero parse error would surface here)");
}

main();
