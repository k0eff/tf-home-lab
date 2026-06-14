const { connectWs, rest } = require("./ha_ws_util");

const rooms = [
  {
    path: "living",
    title: "LivingR",
    automationId: "1770077000010",
    request: "input_boolean.livingr_program_requested",
  },
  {
    path: "bedb",
    title: "BedroomB",
    automationId: "1770077000021",
    request: "input_boolean.bedroomb_program_requested",
  },
];

function cards(view) {
  return view.cards || [];
}

function hasTitle(view, title) {
  return cards(view).some((card) => card.title === title);
}

function hasContent(view, text) {
  return cards(view).some((card) => String(card.content || "").includes(text));
}

function hasEntity(view, entity) {
  return JSON.stringify(cards(view)).includes(entity);
}

(async () => {
  const ws = await connectWs();
  const dashRes = await ws.request({ id: 1, type: "lovelace/config", url_path: "my-dash" });
  if (!dashRes.success) throw new Error(JSON.stringify(dashRes));
  const dash = dashRes.result;

  const out = {};
  for (const room of rooms) {
    const view = dash.views.find((candidate) => candidate.path === room.path);
    const cfg = await rest(`/api/config/automation/config/${room.automationId}`);
    const cfgText = JSON.stringify(cfg);
    out[room.title] = {
      scenarioTargets: hasTitle(view, "Scenario targets"),
      scenarioThresholds: hasTitle(view, "Scenario thresholds"),
      tuning: hasTitle(view, "Tuning"),
      overshootInfo: hasTitle(view, "Cooling overshoot"),
      programLog: hasTitle(view, "Program log"),
      programCycleKept: hasTitle(view, "Program cycle"),
      oldPrimaryRemoved: !hasTitle(view, "Primary"),
      oldSeasonRemoved: !hasTitle(view, "Season"),
      currentStateRemoved: !hasContent(view, "Current program state"),
      programRequestButton: hasEntity(view, room.request),
      nightTargetsInAutomation: cfgText.includes("night_summer_target") && cfgText.includes("night_winter_target"),
      nightComfortGuard: cfgText.includes("Night comfort band"),
    };
  }
  ws.close();
  console.log(JSON.stringify(out, null, 2));
})();
