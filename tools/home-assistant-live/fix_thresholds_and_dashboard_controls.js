const { connectWs, rest } = require("./ha_ws_util");

const rooms = [
  {
    title: "LivingR",
    viewPath: "living",
    climate: "climate.hol_2",
    automation: "automation.test_aircon_livingr_room_sensor_comfort_band",
    automationId: "1770077000010",
    power: "switch.hol_power",
    prefix: "livingr",
  },
  {
    title: "BedroomB",
    viewPath: "bedb",
    climate: "climate.v357_spalniag_2",
    automation: "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    automationId: "1770077000021",
    power: "switch.v357_spalniag_power",
    prefix: "bedroomb",
  },
];

function patchAutomationStrings(value) {
  if (Array.isArray(value)) return value.map(patchAutomationStrings);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = patchAutomationStrings(v);
    return out;
  }
  if (typeof value !== "string") return value;
  return value
    .replaceAll("effective > target + cooling_start_delta", "effective >= target + cooling_start_delta")
    .replaceAll("effective < target - winter_start_delta", "effective <= target - winter_start_delta")
    .replaceAll("effective > target + active_cooling_start_delta", "effective >= target + active_cooling_start_delta")
    .replaceAll("effective < target - active_winter_start_delta", "effective <= target - active_winter_start_delta");
}

function findCards(cards, predicate, parent = null) {
  const results = [];
  for (let i = 0; i < (cards || []).length; i += 1) {
    const card = cards[i];
    if (predicate(card)) results.push({ card, index: i, parent: cards });
    if (card.cards) results.push(...findCards(card.cards, predicate, card.cards));
  }
  return results;
}

function stateMarkdown(room) {
  return `### Current program state

{% set night_start = states('input_datetime.${room.prefix}_night_start') %}
{% set day_start = states('input_datetime.${room.prefix}_day_start') %}
{% set clean_start = states('input_datetime.${room.prefix}_air_clean_start') %}
{% set clean_end = states('input_datetime.${room.prefix}_air_clean_end') %}
{% set ns = night_start.split(':') %}
{% set ds = day_start.split(':') %}
{% set cs = clean_start.split(':') %}
{% set ce = clean_end.split(':') %}
{% set now_m = now().hour * 60 + now().minute %}
{% set night_m = (ns[0] | int) * 60 + (ns[1] | int) %}
{% set day_m = (ds[0] | int) * 60 + (ds[1] | int) %}
{% set clean_s = (cs[0] | int) * 60 + (cs[1] | int) %}
{% set clean_e = (ce[0] | int) * 60 + (ce[1] | int) %}
{% set is_night = (now_m >= night_m and now_m < day_m) if night_m < day_m else (now_m >= night_m or now_m < day_m) %}
{% set is_clean = (now_m >= clean_s and now_m < clean_e) if clean_s < clean_e else (now_m >= clean_s or now_m < clean_e) %}
**Program:** {{ states('${room.automation}') }}  
**Aircon:** {{ states('${room.climate}') }}{% if state_attr('${room.climate}', 'current_temperature') is not none %} / {{ state_attr('${room.climate}', 'current_temperature') }}°C{% endif %}  
**Window:** {% if is_clean %}Air clean{% elif is_night %}Night{% else %}Day{% endif %}  
**Day starts:** {{ day_start }} · **Night starts:** {{ night_start }} · **Air clean:** {{ clean_start }}-{{ clean_end }}`;
}

function controlGrid(room) {
  return {
    type: "grid",
    columns: 3,
    square: false,
    cards: [
      { type: "tile", entity: room.automation, name: "Program", icon: "mdi:robot", tap_action: { action: "toggle" } },
      { type: "tile", entity: room.climate, name: "Aircon", icon: "mdi:air-conditioner", tap_action: { action: "more-info" } },
      { type: "tile", entity: room.power, name: "Power", icon: "mdi:power-plug", tap_action: { action: "toggle" } },
    ],
  };
}

function scheduleGrid(room) {
  return {
    type: "vertical-stack",
    cards: [
      { type: "markdown", content: "### Program times" },
      {
        type: "grid",
        columns: 2,
        square: false,
        cards: [
          { type: "tile", entity: `input_datetime.${room.prefix}_day_start`, name: "Day starts", icon: "mdi:weather-sunny" },
          { type: "tile", entity: `input_datetime.${room.prefix}_night_start`, name: "Night starts", icon: "mdi:weather-night" },
          { type: "tile", entity: `input_datetime.${room.prefix}_air_clean_start`, name: "Clean starts", icon: "mdi:fan-clock" },
          { type: "tile", entity: `input_datetime.${room.prefix}_air_clean_end`, name: "Clean ends", icon: "mdi:fan-off" },
        ],
      },
    ],
  };
}

function isOldTopControl(card) {
  if (card.type === "horizontal-stack" && JSON.stringify(card).includes("Program")) return true;
  if (card.type === "grid" && JSON.stringify(card).includes("mdi:robot")) return true;
  return false;
}

function isOldSchedule(card) {
  return card.title === "Schedule" || JSON.stringify(card).includes("Program times");
}

(async () => {
  for (const room of rooms) {
    const config = await rest(`/api/config/automation/config/${room.automationId}`);
    await rest(`/api/config/automation/config/${room.automationId}`, "POST", patchAutomationStrings(config));
  }
  await rest("/api/services/automation/reload", "POST", {});

  const ws = await connectWs();
  let id = 1;
  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!lovelace.success) throw new Error(JSON.stringify(lovelace));
  const dash = lovelace.result;

  for (const room of rooms) {
    const view = dash.views.find((v) => v.path === room.viewPath);
    if (!view) throw new Error(`${room.viewPath} view missing`);
    view.cards = (view.cards || []).filter((card) => !isOldTopControl(card) && !isOldSchedule(card));
    view.cards.unshift(
      { type: "markdown", content: stateMarkdown(room) },
      controlGrid(room),
      scheduleGrid(room),
    );
  }

  const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config: dash });
  if (!save.success) throw new Error(JSON.stringify(save));
  ws.close();

  const states = await rest("/api/states");
  const wanted = rooms.flatMap((r) => [
    r.automation,
    r.climate,
    `input_datetime.${r.prefix}_day_start`,
    `input_datetime.${r.prefix}_night_start`,
  ]);
  console.log(JSON.stringify({
    updated: true,
    states: Object.fromEntries(states.filter((s) => wanted.includes(s.entity_id)).map((s) => [s.entity_id, s.state])),
  }, null, 2));
})();
