// Fixes a one-way desync found 2026-07-24: the dashboard "Program request" tile
// (input_boolean.bedrooms_program_requested) only reflects what was *requested*
// through the tile itself. If the real automation
// (automation.test_aircon_bedrooms_room_sensor_comfort_band) gets disabled any
// other way - HA UI, developer tools, a restart, or a person toggling it directly
// (as Ema did at 01:38 on 2026-07-24) - the tile keeps showing the old state
// forever, because nothing ever synced the real automation state back into the
// request boolean.
//
// bedrooms_program_reconciliation.json adds a small watcher automation: on every
// on/off transition of the real automation, if the request boolean disagrees, it
// corrects the boolean to match reality and logs why. This makes the dashboard
// tile a mirror of ground truth regardless of how the automation state changed.
//
// No-loop argument (verified live 2026-07-24): the existing debounce automation
// "[TEST] AirCon - BedroomS - delayed program toggle" reacts to the request
// boolean by re-applying automation.turn_on/off to match it - but by the time it
// fires, the automation is already in that state, so its action is a no-op, not a
// state change, so this reconciliation automation is not re-triggered. Confirmed
// by toggling the real automation directly twice and watching both entities
// settle without oscillation.
//
// Run: node apply_bedrooms_program_reconciliation.js

const fs = require("fs");
const path = require("path");
const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000110";
const CONFIG_PATH = path.join(__dirname, "bedrooms_program_reconciliation.json");

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (config.id !== AUTOMATION_ID) {
    throw new Error(`config id ${config.id} does not match expected ${AUTOMATION_ID}`);
  }

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", config);
  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/turn_on", "POST", {
    entity_id: "automation.test_aircon_bedrooms_program_state_reconciliation",
  });

  const states = await rest("/api/states", "GET");
  const entity = states.find(
    (s) => s.entity_id === "automation.test_aircon_bedrooms_program_state_reconciliation"
  );
  console.log("applied. entity state:", entity && entity.state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
