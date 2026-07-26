/**
 * backport_fan_speed_boost_terraform.js
 *
 * Backports the live fan-speed-boost patch (applied via apply_fan_speed_boost.js)
 * into app/stacks/home-assistant/main.tf for the 3 comfort-band automation
 * resources (LivingR, BedroomB, BedroomS). Pure local text transform -- no
 * HA API calls. Mirrors extendCoolingFanMode/boostAwareLiteral exactly so the
 * Terraform source matches what is now live.
 */

const fs = require("fs");
const path = require("path");
const { boostAwareLiteral } = require("./apply_fan_speed_boost");

const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");

// Descending by line number: insertions add real newlines to the file, so a
// room processed first must not shift the still-to-be-processed ranges below
// it. Editing bottom-to-top keeps every other room's line range valid.
const ROOMS = [
  { prefix: "bedrooms", start: 5112, end: 5648 },
  { prefix: "bedroomb", start: 1147, end: 1696 },
  { prefix: "livingr", start: 300, end: 836 },
];

function toHclString(template) {
  return template.replace(/\n/g, "\\n");
}

// main.tf stores multi-line Jinja templates as ONE physical HCL line with
// literal `\n` (backslash + n) marking where Jinja line breaks go -- unlike
// the live JSON config, where JSON.parse turns `\n` into real newline bytes.
// This mirrors apply_fan_speed_boost.js's extendCoolingFanMode but escapes
// the newly-inserted set-statement's line break as literal `\n` instead of
// a real newline, so it matches main.tf's on-disk encoding.
function extendCoolingFanModeHcl(text, prefix) {
  const find = `{% set cooling_fan_mode = (states('input_number.${prefix}_return_boost_fan_mode') | int(5)) if return_boost_active else (states('input_number.${prefix}_cooling_fan_mode') | int(2)) %}`;
  if (!text.includes(find)) return text;
  const replace = `{% set fan_boost_latch_on = is_state('input_boolean.${prefix}_fan_boost_active', 'on') %}\\n{% set cooling_fan_mode = (states('input_number.${prefix}_return_boost_fan_mode') | int(5)) if (return_boost_active or fan_boost_latch_on) else (states('input_number.${prefix}_cooling_fan_mode') | int(2)) %}`;
  return text.split(find).join(replace);
}

function assertFound(idx, prefix, what) {
  if (idx < 0) throw new Error(`${prefix}: ${what} not found`);
  return idx;
}

function replaceLiteralAfter(text, prefix, aliasMarker, literalPattern, replacementValue) {
  const aliasIdx = assertFound(text.indexOf(aliasMarker), prefix, `alias "${aliasMarker}"`);
  const litIdx = assertFound(text.indexOf(literalPattern, aliasIdx), prefix, `literal "${literalPattern}" after "${aliasMarker}"`);
  return text.slice(0, litIdx) + `"fan_mode" = "${toHclString(replacementValue)}"` + text.slice(litIdx + literalPattern.length);
}

function extractSetupPrefix(text, prefix) {
  const marker = "{{ not manual_override_active }}";
  const markerIdx = assertFound(text.indexOf(marker), prefix, "master condition tail marker");
  const valueStart = text.lastIndexOf('"value_template" = "', markerIdx);
  assertFound(valueStart, prefix, "master condition value_template start");
  const contentStart = valueStart + '"value_template" = "'.length;
  return text.slice(contentStart, markerIdx);
}

function buildLatchActionHcl(prefix, setupPrefixHcl) {
  const onTemplate = `${setupPrefixHcl}{% set fan_boost_threshold = states('input_number.${prefix}_fan_boost_threshold') | float(1.0) %}\\n{{ error is not none and (error | abs) >= fan_boost_threshold }}`;
  const offTemplate = `${setupPrefixHcl}{% set fan_boost_threshold = states('input_number.${prefix}_fan_boost_threshold') | float(1.0) %}\\n{% set fan_boost_release_margin = states('input_number.${prefix}_fan_boost_release_margin') | float(0.5) %}\\n{% set fan_boost_effective_margin = [fan_boost_release_margin, fan_boost_threshold - 0.01] | min %}\\n{{ is_state('input_boolean.${prefix}_fan_boost_active', 'on') and error is not none and (error | abs) < (fan_boost_threshold - fan_boost_effective_margin) }}`;

  return `    {
      "alias" = "Track fan-speed boost latch (error threshold trigger)"
      "if" = [
        {
          "condition"      = "template"
          "value_template" = "${onTemplate}"
        }
      ]
      "then" = [
        {
          "service" = "input_boolean.turn_on"
          "target" = {
            "entity_id" = "input_boolean.${prefix}_fan_boost_active"
          }
        }
      ]
      "else" = [
        {
          "if" = [
            {
              "condition"      = "template"
              "value_template" = "${offTemplate}"
            }
          ]
          "then" = [
            {
              "service" = "input_boolean.turn_off"
              "target" = {
                "entity_id" = "input_boolean.${prefix}_fan_boost_active"
              }
            }
          ]
        }
      ]
    },
`;
}

function insertLatchAction(text, prefix, setupPrefixHcl) {
  const anchor = '\n    },\n    {\n      "choose" = [';
  const idx = assertFound(text.indexOf(anchor), prefix, "away-action / choose-block boundary");
  const insertPoint = idx + "\n    },\n".length;
  const block = buildLatchActionHcl(prefix, setupPrefixHcl);
  return text.slice(0, insertPoint) + block + text.slice(insertPoint);
}

function patchDescription(text, prefix) {
  const marker = '  description = "';
  const start = assertFound(text.indexOf(marker), prefix, "description attribute");
  const contentStart = start + marker.length;
  const lineEnd = assertFound(text.indexOf('"\n', contentStart), prefix, "description closing quote");
  const sentence = ` FAN-SPEED BOOST: when |error| (effective - target) crosses input_number.${prefix}_fan_boost_threshold (default 1.0C) in either direction, input_boolean.${prefix}_fan_boost_active latches on (a new \\"Track fan-speed boost latch\\" action, mirroring the return-boost tracker) and releases only once |error| drops below (threshold - input_number.${prefix}_fan_boost_release_margin, default 0.5C). This latch is OR-combined with the existing return_boost_active condition inside cooling_fan_mode, so both triggers share the same input_number.${prefix}_return_boost_fan_mode speed and override fan_mode regardless of hvac/fan_only phase (night air-clean, daytime no-motion raise, daytime motion-restore, winter heat all became boost-aware). Symmetric for summer overshoot and winter undershoot.`;
  return text.slice(0, lineEnd) + sentence + text.slice(lineEnd);
}

function patchRoom(fullText, room) {
  const lines = fullText.split("\n");
  const before = lines.slice(0, room.start - 1).join("\n");
  const slice = lines.slice(room.start - 1, room.end).join("\n");
  const after = lines.slice(room.end).join("\n");

  let patched = extendCoolingFanModeHcl(slice, room.prefix);

  patched = replaceLiteralAfter(patched, room.prefix, "Night: air cleaning fan only at max speed", '"fan_mode" = "5"', boostAwareLiteral(room.prefix, "5"));
  patched = replaceLiteralAfter(patched, room.prefix, "Daytime no motion: raise fan while climate is already running", '"fan_mode" = "5"', boostAwareLiteral(room.prefix, "5"));
  patched = replaceLiteralAfter(patched, room.prefix, "Daytime motion: restore fan 3 while climate is already running", '"fan_mode" = "3"', boostAwareLiteral(room.prefix, "3"));
  patched = replaceLiteralAfter(patched, room.prefix, "Winter: heat when room is below 21.5C", '"fan_mode" = "3"', boostAwareLiteral(room.prefix, "3"));

  const setupPrefixHcl = extractSetupPrefix(patched, room.prefix);
  patched = insertLatchAction(patched, room.prefix, setupPrefixHcl);

  patched = patchDescription(patched, room.prefix);

  return [before, patched, after].filter((s) => s.length > 0).join("\n");
}

function main() {
  let text = fs.readFileSync(MAIN_TF, "utf8");

  for (const room of ROOMS) {
    const lines = text.split("\n");
    const aliasCheck = lines.slice(room.start - 1, room.end).join("\n");
    if (!aliasCheck.includes(`resource "homeassistant_automation" "test_aircon_${room.prefix}`) && !aliasCheck.includes(`comfort_band`)) {
      throw new Error(`${room.prefix}: line range ${room.start}-${room.end} does not look like the expected resource block`);
    }
    text = patchRoom(text, room);
  }

  fs.writeFileSync(MAIN_TF, text);
  console.log("main.tf patched for:", ROOMS.map((r) => r.prefix).join(", "));
}

main();
