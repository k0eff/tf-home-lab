// 2026-07-24: user confirmed winter night behavior for BedroomS stays (unlike
// summer, see apply_bedrooms_summer_night_fix.js) but the maintained temperature
// was too low. Decision: night winter heating target is 21C (was 19C), still
// below the day winter target (22C) so the AC stays off most of the time and
// only kicks in to hold the floor - not to actively push heat all night.
//
// This script always re-asserts the value (not just create-if-missing) so the
// correct default survives being fat-fingered in the UI or reset during a
// helper recreate - run it any time to restore the intended value.
//
// Run: node apply_bedrooms_winter_night_target.js

const { connectWs, rest } = require("./ha_ws_util");

const HELPER_ID = "bedrooms_winter_night_target";
const TARGET_VALUE = 21.0;

async function main() {
  const ws = await connectWs();
  const list = await ws.request({ id: 1, type: "input_number/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === HELPER_ID);
  if (!existing) throw new Error(`input_number.${HELPER_ID} does not exist - refusing to create blind, check entity name`);

  ws.close();

  await rest("/api/services/input_number/set_value", "POST", {
    entity_id: `input_number.${HELPER_ID}`,
    value: TARGET_VALUE,
  });

  const states = await rest("/api/states", "GET");
  const e = states.find((s) => s.entity_id === `input_number.${HELPER_ID}`);
  console.log(`input_number.${HELPER_ID} =`, e && e.state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
