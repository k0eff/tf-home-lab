// Mirrors the two live fixes from the 2026-08-06 BedroomB incident into
// main.tf, so a future `terraform apply` cannot revert them:
//   fix_bedroomb_fan_boost_overcool.js       (season-aware boost, resolver, threshold)
//   fix_bedroomb_cooldown_shutdown_deadlock.js (fan-equality shutdown deadlock)
//
// main.tf stores each multi-line Jinja template as ONE physical HCL line with
// literal 2-char "\n" sequences rather than real newline bytes, so the
// live-JSON-oriented replacement strings do not match it verbatim - the
// newline-bearing ones are re-expressed here with escaped "\\n".
//
// Scoped by brace-matching the test_aircon_bedroomb_room_sensor_comfort_band
// resource block: the fan-boost ON predicate is byte-identical across all
// three rooms' resources, so a whole-file replace would silently patch
// LivingR and BedroomS too, which this slice deliberately leaves alone.
//
// One-off; not meant to be re-run (it asserts its expected match counts and
// refuses to write if they do not hold).
//
// Run: node backport_bedroomb_fan_boost_overcool_terraform.js

const fs = require("fs");
const path = require("path");

const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");
const RESOURCE = 'resource "homeassistant_automation" "test_aircon_bedroomb_room_sensor_comfort_band" {';

const NL = "\\n"; // literal backslash-n as stored inside main.tf's HCL strings
const BOOST_ERROR_DEF =
  "{% set boost_error = none if error is none else (error if climate_mode == 'summer' else (0 - error)) %}" + NL;

const REPLACEMENTS = [
  {
    label: "latch ON condition",
    expect: 1,
    from: "{{ error is not none and (error | abs) >= fan_boost_threshold }}",
    to: BOOST_ERROR_DEF + "{{ boost_error is not none and boost_error >= fan_boost_threshold }}",
  },
  {
    label: "latch RELEASE condition",
    expect: 1,
    from:
      "{{ is_state('input_boolean.bedroomb_fan_boost_active', 'on') and error is not none and (error | abs) < (fan_boost_threshold - fan_boost_effective_margin) }}",
    to:
      BOOST_ERROR_DEF +
      "{{ is_state('input_boolean.bedroomb_fan_boost_active', 'on') and (boost_error is none or boost_error < (fan_boost_threshold - fan_boost_effective_margin)) }}",
  },
  {
    label: "room/AC disagreement resolver",
    expect: 30,
    from:
      "{% if room_ac_conflict %}" + NL +
      "  {% set source = 'conflict_worst_case' %}" + NL +
      "  {% set effective = ([candidate, ac_temp] | max) if climate_mode == 'summer' else ([candidate, ac_temp] | min) if climate_mode == 'winter' else candidate %}" + NL +
      "{% else %}",
    to:
      "{% if room_ac_conflict %}" + NL +
      "  {% set source = 'conflict_trust_room_sensor' %}" + NL +
      "  {% set effective = candidate %}" + NL +
      "{% else %}",
  },
  {
    label: "cooldown-shutdown fan-equality deadlock clause",
    expect: 1,
    from: "(state_attr('climate.v357_spalniag_2', 'fan_mode') or '') == (cooling_fan_mode | string) and ",
    to: "",
  },
];

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// Quote-aware structural balance, same soundness check eval 006 used.
function balance(src) {
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
  if (depth !== 0) throw new Error("unbalanced braces while scoping BedroomB resource");
  return { open, close: i + 1 };
}

function main() {
  const original = fs.readFileSync(MAIN_TF, "utf8");
  const { open, close } = resourceBlock(original);
  let block = original.slice(open, close);
  const beforeBalance = balance(original);

  for (const r of REPLACEMENTS) {
    const found = countOccurrences(block, r.from);
    console.log(`${r.label}: found ${found}, expected ${r.expect}`);
    if (found !== r.expect) {
      throw new Error(`refusing to write: "${r.label}" matched ${found} times, expected ${r.expect}`);
    }
    block = block.split(r.from).join(r.to);
  }

  const patched = original.slice(0, open) + block + original.slice(close);

  const residual = {
    "(error | abs)": countOccurrences(block, "(error | abs)"),
    conflict_worst_case: countOccurrences(block, "conflict_worst_case"),
    deadlock_clause: countOccurrences(block, "== (cooling_fan_mode | string) and "),
  };
  console.log("residual inside BedroomB block:", JSON.stringify(residual));
  if (Object.values(residual).some((v) => v !== 0)) {
    throw new Error("refusing to write: old patterns remain inside the BedroomB block");
  }

  // The other two rooms must be untouched.
  const siblingAbs = countOccurrences(patched, "(error | abs)");
  const siblingConflict = countOccurrences(patched, "conflict_worst_case");
  console.log(`whole file after patch: (error | abs)=${siblingAbs}, conflict_worst_case=${siblingConflict}`);
  // LivingR and BedroomS keep both of their own latch legs (ON + RELEASE) each.
  if (siblingAbs !== 4) {
    throw new Error(`expected LivingR+BedroomS to retain 4 abs() predicates, found ${siblingAbs}`);
  }
  if (siblingConflict === 0) {
    throw new Error("expected LivingR+BedroomS to still carry conflict_worst_case");
  }

  const afterBalance = balance(patched);
  const delta = Object.fromEntries(
    Object.keys(beforeBalance).map((k) => [k, afterBalance[k] - beforeBalance[k]]),
  );
  console.log("brace/bracket/paren delta:", JSON.stringify(delta));
  // Derived per replacement, not observed after the fact:
  //   conflict x30: drops 2 "[...]" and 2 "(...)" each -> -60 brackets, -60 parens
  //   ON:      "{{..}}" -> "{%..%}\n{{..}}"  -> +1 brace, +1 paren
  //   RELEASE: same brace shape                -> +1 brace, +2 parens
  //   deadlock clause removed                  -> -3 parens
  const expectedDelta = { "{": 2, "}": 2, "[": -60, "]": -60, "(": -60, ")": -60 };
  for (const k of Object.keys(expectedDelta)) {
    if (delta[k] !== expectedDelta[k]) {
      throw new Error(
        `structural delta mismatch for "${k}": got ${delta[k]}, expected ${expectedDelta[k]}`,
      );
    }
  }

  fs.writeFileSync(MAIN_TF, patched);
  console.log("main.tf written");
}

main();
