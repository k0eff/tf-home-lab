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
  const living = await rest("/api/config/automation/config/1770077000010");
  const bed = await rest("/api/config/automation/config/1770077000021");
  const ws = await connectWs();
  let id = 1;
  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  ws.close();
  const views = lovelace.result.views;
  const livingView = views.find((v) => v.path === "living");
  const bedView = views.find((v) => v.path === "bedb");
  const home = views[0];
  const result = {
    automationTimeHelpers: {
      living: JSON.stringify(living).includes("input_datetime.livingr_night_start"),
      bedb: JSON.stringify(bed).includes("input_datetime.bedroomb_night_start"),
    },
    views: {
      living: {
        title: livingView?.title,
        path: livingView?.path,
        hasProgramCycle: Boolean(findCards(livingView?.cards, (c) => c.title === "Program cycle").length),
        hasSchedule: Boolean(findCards(livingView?.cards, (c) => c.title === "Schedule").length),
        hasCrossLinkButton: Boolean(findCards(livingView?.cards, (c) => ["LivingR Tune", "BedroomB Tune", "Living Tune", "BedB Tune"].includes(c.name)).length),
      },
      bedb: {
        title: bedView?.title,
        path: bedView?.path,
        hasProgramCycle: Boolean(findCards(bedView?.cards, (c) => c.title === "Program cycle").length),
        hasSchedule: Boolean(findCards(bedView?.cards, (c) => c.title === "Schedule").length),
        hasNight: Boolean(findCards(bedView?.cards, (c) => c.title === "Night").length),
        hasSensorStack: Boolean(findCards(bedView?.cards, (c) => c.title === "Sensors" && JSON.stringify(c).includes("sensor.miaomiaoce_t2_faea_temperature_humidity_sensor")).length),
        hasCrossLinkButton: Boolean(findCards(bedView?.cards, (c) => ["LivingR Tune", "BedroomB Tune", "Living Tune", "BedB Tune"].includes(c.name)).length),
      },
      homeHasMainLinks: Boolean(JSON.stringify(home).includes("/my-dash/living") && JSON.stringify(home).includes("/my-dash/bedb")),
    },
  };
  console.log(JSON.stringify(result, null, 2));
})();
