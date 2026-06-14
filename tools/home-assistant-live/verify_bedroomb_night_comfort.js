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
  const text = JSON.stringify(automation);
  const ws = await connectWs();
  let id = 1;
  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  ws.close();
  const view = lovelace.result.views.find((v) => v.path === "bedroomb-tuning" || v.title === "BedroomB Tune");
  const nightCards = findCards(view.cards, (card) => card.title === "Night comfort");
  const states = await rest("/api/states");
  const helperStates = Object.fromEntries(states
    .filter((s) => s.entity_id.startsWith("input_number.bedroomb_night_") || s.entity_id === "automation.test_aircon_bedroomb_room_sensor_comfort_band")
    .map((s) => [s.entity_id, s.state]));

  console.log(JSON.stringify({
    hasNightSummerTarget: text.includes("input_number.bedroomb_night_summer_target"),
    hasNightWinterTarget: text.includes("input_number.bedroomb_night_winter_target"),
    summerAllowedAtNight: text.includes("not night_air_clean_window and climate_mode == 'summer'") && text.includes("active_cooling_start_delta"),
    winterAllowedAtNight: text.includes("not night_air_clean_window and climate_mode == 'winter'") && text.includes("active_winter_start_delta"),
    nightOffOnlyInsideBand: text.includes("Night comfort band: climate off until room leaves the configured night band"),
    panelHasNightComfort: nightCards.length > 0,
    helperStates,
  }, null, 2));
})();
