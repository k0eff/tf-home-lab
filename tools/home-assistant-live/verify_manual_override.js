const { connectWs, rest } = require("./ha_ws_util");

const rooms = [
  {
    title: "LivingR",
    prefix: "livingr",
    viewPath: "living",
    comfortId: "1770077000010",
    overrideId: "1770077000041",
  },
  {
    title: "BedroomB",
    prefix: "bedroomb",
    viewPath: "bedb",
    comfortId: "1770077000021",
    overrideId: "1770077000042",
  },
];

(async () => {
  const ws = await connectWs();
  const states = await rest("/api/states");
  const dashRes = await ws.request({ id: 1, type: "lovelace/config", url_path: "my-dash" });
  if (!dashRes.success) throw new Error(JSON.stringify(dashRes));
  const dash = dashRes.result;
  const out = {};
  for (const room of rooms) {
    const comfort = await rest(`/api/config/automation/config/${room.comfortId}`);
    const override = await rest(`/api/config/automation/config/${room.overrideId}`);
    const view = dash.views.find((item) => item.path === room.viewPath);
    const viewText = JSON.stringify(view?.cards || []);
    const stateIds = new Set(states.map((item) => item.entity_id));
    const helpers = [
      `input_boolean.${room.prefix}_manual_override`,
      `input_number.${room.prefix}_override_duration`,
      `input_number.${room.prefix}_manual_target_temperature`,
      `input_select.${room.prefix}_manual_hvac_mode`,
      `input_select.${room.prefix}_manual_fan_mode`,
      `input_select.${room.prefix}_manual_swing_mode`,
      `input_datetime.${room.prefix}_manual_override_until`,
    ];
    out[room.title] = {
      helpersPresent: helpers.every((entity) => stateIds.has(entity)),
      comfortStandsDown: JSON.stringify(comfort).includes("not manual_override_active"),
      comfortComputesManualActive: JSON.stringify(comfort).includes("manual_override_active"),
      overrideAutomationPresent: override.alias?.includes("manual override") || override.alias?.includes("Manual override"),
      overrideAppliesClimate: JSON.stringify(override).includes("climate.set_hvac_mode") && JSON.stringify(override).includes("climate.set_fan_mode") && JSON.stringify(override).includes("climate.set_swing_mode"),
      dashboardCardPresent: viewText.includes("Manual override") && viewText.includes(`${room.prefix}_manual_target_temperature`),
    };
  }
  ws.close();
  console.log(JSON.stringify(out, null, 2));
})();
