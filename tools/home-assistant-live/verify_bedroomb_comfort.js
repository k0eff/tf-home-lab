const { connectWs, rest } = require("./ha_ws_util");

function findCards(cards, predicate) {
  const results = [];
  for (const card of cards || []) {
    if (predicate(card)) results.push(card);
    if (card.cards) results.push(...findCards(card.cards, predicate));
  }
  return results;
}

(async () => {
  const automation = await rest("/api/config/automation/config/1770077000021");
  const templates = JSON.stringify(automation);
  const checks = {
    automationId: automation.id,
    alias: automation.alias,
    hasActiveClimate: templates.includes("climate.v357_spalniag_2"),
    hasPrimarySensor: templates.includes("sensor.miaomiaoce_t2_5249_temperature_humidity_sensor"),
    hasCeilingFallback: templates.includes("sensor.miaomiaoce_t2_faea_temperature_humidity_sensor"),
    hasMotion03: templates.includes("binary_sensor.motion03"),
    hasConditionTail: templates.includes("{{ outside is not none }}") && templates.includes("effective > target + cooling_start_delta"),
    noLivingClimate: !templates.includes("climate.hol_2"),
    noLivingMotion: !templates.includes("binary_sensor.motion01"),
  };

  const ws = await connectWs();
  let id = 1;
  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  ws.close();
  if (!lovelace.success) throw new Error(JSON.stringify(lovelace));
  const view = lovelace.result.views.find((v) => v.path === "bedroomb-tuning" || v.title === "BedroomB Tune");
  const viewJson = JSON.stringify(view || {});
  checks.dashboard = {
    exists: Boolean(view),
    hasTargetHelper: viewJson.includes("input_number.bedroomb_target_temperature"),
    hasEnergySensor: viewJson.includes("sensor.v357_spalniag_energy_2"),
    hasClimate: viewJson.includes("climate.v357_spalniag_2"),
    noLivingEnergy: !viewJson.includes("sensor.hol_energy_2"),
  };

  const states = await rest("/api/states");
  const wanted = [
    "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    "automation.v2_aircon_morning_bedroomb_summer",
    "automation.v2_aircon_night_bedroomb_summer",
    "automation.v2_aircon_morning_bedroomb_winter",
    "automation.v2_aircon_night_bedroomb_winter",
    "input_number.bedroomb_target_temperature",
    "input_number.bedroomb_cooling_overshoot",
    "input_number.bedroomb_cooling_stop_room_temp",
  ];
  checks.states = Object.fromEntries(states.filter((s) => wanted.includes(s.entity_id)).map((s) => [s.entity_id, s.state]));
  console.log(JSON.stringify(checks, null, 2));
})();
