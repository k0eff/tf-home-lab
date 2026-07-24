// Incident 2026-07-24: BedroomS hit 24.5C at ~04:00, no active cooling all night.
//
// Root cause (two layers):
//  1. Proximate: Ema disabled automation.test_aircon_bedrooms_room_sensor_comfort_band
//     directly and cooled the room by hand around 04:38-04:39 (confirmed via logbook
//     context_user_id -> config/auth/list -> user "ema").
//  2. Structural, present even without manual interference: the automation itself
//     hardcoded two night-only blocks that prevented active cooling 00:30-08:30:
//       - "Night: air cleaning fan only at max speed" forced fan_only 03:00-06:00
//         with no temperature escape valve.
//       - "Night: sleep keeps climate off outside air-clean window" relaxed the
//         summer target to input_number.bedrooms_summer_night_target (30C) and
//         gated real cooling behind allow_night_cooling.
//
// User's explicit decision (verbatim ask): there is no "night sleep window" concept
// in BedroomS. Cooling must run from 19:30 onward during warm months, March through
// November inclusive. Winter behavior (Dec-Feb) was not reported broken and is left
// untouched on purpose.
//
// Fix applied to bedrooms_comfort_band.json (all instances, ~28x each occurrence):
//  - Both night-restriction branches' trailing `{{ EXPR }}` wrapped as
//    `{{ (EXPR) and not (now().month >= 3 and now().month <= 11) }}` so neither
//    branch can ever fire March-November, only Dec/Jan/Feb.
//  - Dropped the `night_summer_target if night_sleep_window and climate_mode ==
//    'summer' else` branch from the `target` ternary - summer target is always
//    day_summer_target now, no night relaxation.
//  - Replaced `(night_cooling_start_delta if night_sleep_window else
//    cooling_start_delta)` with plain `cooling_start_delta` - no smaller night delta.
//  - `(not night_sleep_window or allow_night_cooling)` extended to
//    `(not night_sleep_window or allow_night_cooling or (now().month >= 3 and
//    now().month <= 11))` so the cooling branch is never blocked by
//    night_sleep_window in warm season.
//
// Deployed and live-verified 2026-07-24 via /api/template renders: target no longer
// relaxes to 30C at night, both blocking branches confirmed False for current month.
//
// Helper defaults note: all input_number/input_datetime helpers this automation
// reads (cooling_start_delta, day_summer_target, etc.) are HA storage-based helpers,
// not YAML - their values already survive plain HA restarts natively. They do NOT
// survive a full config-volume/container recreate (same caveat as other integrations
// on this instance, see memory: HA WebSocket/aiohttp fix, HA Ecovacs fixes). This
// script re-applying the automation config is the durable, restart-and-recreate-proof
// part of the fix; the helper *values* themselves are not re-asserted here because
// they were not the thing that broke - only the automation's own logic was.
//
// Run: node apply_bedrooms_summer_night_fix.js   (requires HA_BASE + HA token env
// already exported by protected/main.sh, same as every other script in this dir)

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
