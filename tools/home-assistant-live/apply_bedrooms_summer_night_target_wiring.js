// Incident 2026-07-24 (found during a working-or-not audit of the BedroomS
// comfort-band automation): `input_number.bedrooms_summer_night_target`
// (correct value 23.5C) was declared in every value_template but never
// actually consumed by the `target` selection formula. During summer
// (climate_mode == 'summer'), target always resolved to `day_summer_target`
// (mild 24.7C or hot 24.5C) regardless of time of day - there was no
// three-tier mild/hot/night behavior in summer, only two tiers.
//
// This is a DIFFERENT bug from the earlier calendar-gate fix
// (apply_bedrooms_summer_night_fix.js), which only disabled the old
// "force climate off during 00:30-08:30 sleep window" enforcement action for
// Mar-Nov. That enforcement action stays disabled for summer (it's what
// caused the original 4am overheat by blocking real cooling) - this fix is
// purely about which numeric target the comfort-band math targets, not about
// forcing the unit off.
//
// User confirmed (2026-07-24) the intended summer behavior: mild summer day
// (24.7C) / hot summer day (24.5C) / night summer (23.5C, stronger than both
// day targets, not weaker) - and that the night window for target-selection
// purposes is 19:30 -> 08:30, BedroomS only (other rooms not touched).
//
// Fix: added a `summer_night_window` check (19:30-08:30, wraps midnight) and
// changed the `target` formula so that when climate_mode == 'summer' and
// summer_night_window is true, target = night_summer_target instead of
// day_summer_target. Applied identically to all 28 occurrences of the
// `target = day_summer_target if climate_mode == 'summer' else ...` template
// line (plain string replace, verified count == 28 before and after).
// Verified live via /api/template at 21:05 local (inside the new night
// window): summer_night_window=True, day_summer_target=24.7, target=23.5.
//
// Run: node apply_bedrooms_summer_night_target_wiring.js

const fs = require("fs");
const path = require("path");
const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000061";
const CONFIG_PATH = path.join(__dirname, "bedrooms_comfort_band.json");

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (config.id !== AUTOMATION_ID) {
    throw new Error(`config id ${config.id} does not match expected ${AUTOMATION_ID}`);
  }

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", config);
  await rest("/api/services/automation/reload", "POST", {});

  const states = await rest("/api/states", "GET");
  const entity = states.find(
    (s) => s.entity_id === "automation.test_aircon_bedrooms_room_sensor_comfort_band"
  );
  console.log("applied. entity state:", entity && entity.state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
