const { connectWs, rest } = require("./ha_ws_util");

const rooms = [
  {
    key: "livingr",
    title: "LivingR",
    viewPath: "living",
    request: "input_boolean.livingr_program_requested",
    requestId: "livingr_program_requested",
    requestName: "LivingR Program Requested",
    program: "automation.test_aircon_livingr_room_sensor_comfort_band",
    delayedId: "1770077000031",
    delayedAlias: "[TEST] AirCon - LivingR - delayed program toggle",
  },
  {
    key: "bedroomb",
    title: "BedroomB",
    viewPath: "bedb",
    request: "input_boolean.bedroomb_program_requested",
    requestId: "bedroomb_program_requested",
    requestName: "BedroomB Program Requested",
    program: "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    delayedId: "1770077000032",
    delayedAlias: "[TEST] AirCon - BedroomB - delayed program toggle",
  },
];

function delayedAutomation(room) {
  return {
    id: room.delayedId,
    alias: room.delayedAlias,
    description: `Debounces ${room.title} program on/off requests from ${room.request}. The dashboard button changes only the requested state; after 5 seconds this automation applies the last requested state to the real comfort-band automation.`,
    mode: "restart",
    trigger: [
      { platform: "state", entity_id: room.request },
    ],
    condition: [
      { condition: "template", value_template: `{{ states('${room.request}') in ['on', 'off'] }}` },
    ],
    action: [
      { delay: { seconds: 5 } },
      {
        choose: [
          {
            alias: "Apply requested on state",
            conditions: [{ condition: "state", entity_id: room.request, state: "on" }],
            sequence: [{ service: "automation.turn_on", target: { entity_id: room.program } }],
          },
          {
            alias: "Apply requested off state",
            conditions: [{ condition: "state", entity_id: room.request, state: "off" }],
            sequence: [{
              service: "automation.turn_off",
              target: { entity_id: room.program },
              data: { stop_actions: false },
            }],
          },
        ],
      },
    ],
  };
}

function findCards(cards, predicate) {
  const results = [];
  for (const card of cards || []) {
    if (predicate(card)) results.push(card);
    if (card.cards) results.push(...findCards(card.cards, predicate));
  }
  return results;
}

(async () => {
  const ws = await connectWs();
  let id = 1;
  const list = await ws.request({ id: ++id, type: "input_boolean/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = new Set(list.result.map((x) => x.id));
  const changes = [];

  for (const room of rooms) {
    const current = await rest(`/api/states/${room.program}`);
    if (!existing.has(room.requestId)) {
      const create = await ws.request({
        id: ++id,
        type: "input_boolean/create",
        name: room.requestName,
        icon: "mdi:timer-sand",
      });
      if (!create.success) throw new Error(JSON.stringify(create));
      changes.push(`created ${room.request}`);
    }
    await rest(`/api/services/input_boolean/turn_${current.state === "on" ? "on" : "off"}`, "POST", {
      entity_id: room.request,
    });
    await rest(`/api/config/automation/config/${room.delayedId}`, "POST", delayedAutomation(room));
  }

  await rest("/api/services/automation/reload", "POST", {});
  for (const room of rooms) {
    await rest("/api/services/automation/turn_on", "POST", { entity_id: `automation.${room.delayedAlias.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}` }).catch(() => null);
  }

  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!lovelace.success) throw new Error(JSON.stringify(lovelace));
  const dash = lovelace.result;
  for (const room of rooms) {
    const view = dash.views.find((v) => v.path === room.viewPath);
    if (!view) throw new Error(`Missing view ${room.viewPath}`);
    const tiles = findCards(view.cards, (card) => card.type === "tile" && (card.entity === room.program || card.name === "Program"));
    for (const tile of tiles) {
      tile.entity = room.request;
      tile.name = "Program request";
      tile.icon = "mdi:timer-sand";
      tile.tap_action = { action: "toggle" };
    }
    const markdown = findCards(view.cards, (card) => card.type === "markdown" && String(card.content || "").includes("Current program state"))[0];
    if (markdown) {
      markdown.content = markdown.content.replace(
        `**Program:** {{ states('${room.program}') }}`,
        `**Program:** {{ states('${room.program}') }} · **Requested:** {{ states('${room.request}') }}`,
      );
    }
  }
  const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config: dash });
  if (!save.success) throw new Error(JSON.stringify(save));
  ws.close();

  const states = await rest("/api/states");
  const wanted = rooms.flatMap((room) => [room.request, room.program, `automation.${room.delayedAlias.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`]);
  console.log(JSON.stringify({
    changes,
    states: Object.fromEntries(states.filter((s) => wanted.includes(s.entity_id)).map((s) => [s.entity_id, s.state])),
  }, null, 2));
})();
