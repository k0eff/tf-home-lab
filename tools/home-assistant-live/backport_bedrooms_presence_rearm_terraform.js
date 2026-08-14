// Mirrors the 2026-08-14 BedroomS presence fix into main.tf, so a future
// `terraform apply` cannot revert it:
//   apply_bedrooms_night_fixed_cooling_presence_rearm.js
//
// The new presence trigger itself is added directly in main.tf (plain HCL, easy
// to review in a diff). This script handles the two replacements that live
// inside the giant single-line Jinja templates, where a hand edit is impractical:
//
//   A. the fixed-cooling branch's allowed trigger.id list gains the new id
//   B. away / away_now additionally require motion_quiet_30m, so a lagging phone
//      tracker cannot declare the house away while motion is actively reporting
//
// Scoped by brace-matching the test_aircon_bedrooms_room_sensor_comfort_band
// resource block: the away predicate is byte-identical across all three rooms'
// resources, so a whole-file replace would silently patch LivingR and BedroomB
// too. The slice deliberately leaves those alone.
//
// One-off; not meant to be re-run (it asserts expected match counts and refuses
// to write if they do not hold).
//
// Run: node backport_bedrooms_presence_rearm_terraform.js

const fs = require("fs");
const path = require("path");

const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");
const RESOURCE = 'resource "homeassistant_automation" "test_aircon_bedrooms_room_sensor_comfort_band" {';

const PRESENCE_TRIGGER_ID = "night_fixed_cooling_presence_home";

const REPLACEMENTS = [
  {
    label: "fixed-cooling trigger.id list",
    expect: 1,
    from: "trigger.id in ['summer_night_fixed_cooling_start', 'night_fixed_cooling_toggle_on']",
    to: `trigger.id in ['summer_night_fixed_cooling_start', 'night_fixed_cooling_toggle_on', '${PRESENCE_TRIGGER_ID}']`,
  },
  {
    label: "away predicate",
    expect: 31,
    from: "{% set away = allow_away_saving and (away_by_presence or away_by_no_motion) %}",
    to: "{% set away = allow_away_saving and (away_by_presence or away_by_no_motion) and motion_quiet_30m %}",
  },
  {
    label: "away_now predicate",
    expect: 1,
    from: "{% set away_now = allow_away_saving and (away_by_presence or away_by_no_motion) %}",
    to: "{% set away_now = allow_away_saving and (away_by_presence or away_by_no_motion) and motion_quiet_30m %}",
  },
];

function resourceSlice(text) {
  const start = text.indexOf(RESOURCE);
  if (start === -1) throw new Error("BedroomS resource block not found");
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") { i += 1; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth += 1;
    else if (c === "}") { depth -= 1; if (depth === 0) return { start, end: i + 1 }; }
  }
  throw new Error("unterminated BedroomS resource block");
}

function patch(text) {
  const { start, end } = resourceSlice(text);
  let block = text.slice(start, end);

  for (const r of REPLACEMENTS) {
    const found = block.split(r.from).length - 1;
    if (found !== r.expect) {
      throw new Error(`${r.label}: expected ${r.expect} occurrences, found ${found}`);
    }
    block = block.split(r.from).join(r.to);
  }

  return text.slice(0, start) + block + text.slice(end);
}

if (require.main === module) {
  const before = fs.readFileSync(MAIN_TF, "utf8");
  const after = patch(before);
  fs.writeFileSync(MAIN_TF, after);
  console.log(JSON.stringify({
    file: path.relative(process.cwd(), MAIN_TF),
    replacements: REPLACEMENTS.map((r) => `${r.label} x${r.expect}`),
    bytes_delta: after.length - before.length,
  }, null, 2));
}

module.exports = { patch, REPLACEMENTS };
