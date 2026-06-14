const { connectWs, rest } = require("./ha_ws_util");

(async () => {
  const states = await rest("/api/states");
  const wanted = states
    .filter((state) =>
      state.entity_id.includes("bedroomb") ||
      state.entity_id.includes("spalniag") ||
      state.entity_id.includes("miaomiaoce_t2_5249") ||
      state.entity_id.includes("miaomiaoce_t2_faea") ||
      state.entity_id.includes("motion03") ||
      state.entity_id.includes("v357_spalniag")
    )
    .map((state) => ({
      entity_id: state.entity_id,
      state: state.state,
      friendly_name: state.attributes?.friendly_name,
      last_changed: state.last_changed,
      current_temperature: state.attributes?.current_temperature,
      temperature: state.attributes?.temperature,
      fan_mode: state.attributes?.fan_mode,
      swing_mode: state.attributes?.swing_mode,
      supported_features: state.attributes?.supported_features,
      unit: state.attributes?.unit_of_measurement,
      device_class: state.attributes?.device_class,
    }));
  console.log("STATES");
  console.log(JSON.stringify(wanted, null, 2));

  const ws = await connectWs();
  let id = 1;
  const commands = [
    { type: "config/automation/list" },
    { type: "config/entity_registry/list" },
    { type: "config/device_registry/list" },
  ];
  for (const command of commands) {
    const res = await ws.request({ id: ++id, ...command });
    console.log(`WS ${command.type}`);
    if (!res.success) {
      console.log(JSON.stringify(res, null, 2));
    } else if (command.type === "config/automation/list") {
      const filtered = res.result.filter((automation) =>
        String(automation.name || automation.alias || automation.id || "").toLowerCase().includes("bedroomb") ||
        String(automation.name || automation.alias || automation.id || "").toLowerCase().includes("spalniag")
      );
      console.log(JSON.stringify(filtered, null, 2));
    } else if (command.type === "config/entity_registry/list") {
      const filtered = res.result.filter((entity) =>
        entity.entity_id.includes("v357_spalniag") ||
        entity.entity_id.includes("miaomiaoce_t2_5249") ||
        entity.entity_id.includes("miaomiaoce_t2_faea") ||
        entity.entity_id.includes("motion03")
      );
      console.log(JSON.stringify(filtered, null, 2));
    } else {
      const filtered = res.result.filter((device) =>
        JSON.stringify(device).toLowerCase().includes("spalniag") ||
        JSON.stringify(device).toLowerCase().includes("bedroomb") ||
        JSON.stringify(device).toLowerCase().includes("bdrmb") ||
        JSON.stringify(device).toLowerCase().includes("v357")
      );
      console.log(JSON.stringify(filtered, null, 2));
    }
  }
  ws.close();
})();
