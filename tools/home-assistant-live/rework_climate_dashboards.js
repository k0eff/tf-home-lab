const { connectWs, rest } = require("./ha_ws_util");

const rooms = {
  livingr: {
    title: "LivingR",
    viewTitle: "Living Tune",
    path: "living",
    icon: "mdi:sofa",
    climate: "climate.hol_2",
    automation: "automation.test_aircon_livingr_room_sensor_comfort_band",
    automationId: "1770077000010",
    tempSensors: [
      "sensor.miaomiaoce_t2_1228_temperature_humidity_sensor",
      "sensor.miaomiaoce_t2_1228_battery_level",
    ],
    energy: "sensor.hol_energy_2",
    power: "switch.hol_power",
    target: "input_number.livingr_target_temperature",
    helpers: {
      hot: "input_number.livingr_hot_summer_target",
      coolDelta: "input_number.livingr_cooling_start_delta",
      fan: "input_number.livingr_cooling_fan_mode",
      cooldown: "input_number.livingr_coil_cooldown_minutes",
      overshoot: "input_number.livingr_cooling_overshoot",
      winter: "input_number.livingr_winter_target",
      winterDelta: "input_number.livingr_winter_start_delta",
      summerOut: "input_number.livingr_summer_outside_threshold",
      winterOut: "input_number.livingr_winter_outside_threshold",
      mildOut: "input_number.livingr_mild_outside_threshold",
      ventiOffset: "input_number.livingr_venti_in_offset",
      roomBatt: "input_number.livingr_room_sensor_min_battery",
      outsideBatt: "input_number.livingr_outside_sensor_min_battery",
    },
  },
  bedroomb: {
    title: "BedroomB",
    viewTitle: "BedB Tune",
    path: "bedb",
    icon: "mdi:bed-king-outline",
    climate: "climate.v357_spalniag_2",
    automation: "automation.test_aircon_bedroomb_room_sensor_comfort_band",
    automationId: "1770077000021",
    tempSensors: [
      "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor",
      "sensor.miaomiaoce_t2_5249_battery_level",
      "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor",
      "sensor.miaomiaoce_t2_faea_battery_level",
      "sensor.v357_spalniag_room_temperature_2",
      "sensor.miaomiaoce_t2_1846_temperature_humidity_sensor",
      "sensor.miaomiaoce_t2_1846_battery_level",
    ],
    energy: "sensor.v357_spalniag_energy_2",
    power: "switch.v357_spalniag_power",
    target: "input_number.bedroomb_target_temperature",
    helpers: {
      hot: "input_number.bedroomb_hot_summer_target",
      coolDelta: "input_number.bedroomb_cooling_start_delta",
      fan: "input_number.bedroomb_cooling_fan_mode",
      cooldown: "input_number.bedroomb_coil_cooldown_minutes",
      overshoot: "input_number.bedroomb_cooling_overshoot",
      winter: "input_number.bedroomb_winter_target",
      winterDelta: "input_number.bedroomb_winter_start_delta",
      nightSummer: "input_number.bedroomb_night_summer_target",
      nightCoolDelta: "input_number.bedroomb_night_cooling_start_delta",
      nightWinter: "input_number.bedroomb_night_winter_target",
      nightWinterDelta: "input_number.bedroomb_night_winter_start_delta",
      summerOut: "input_number.bedroomb_summer_outside_threshold",
      winterOut: "input_number.bedroomb_winter_outside_threshold",
      mildOut: "input_number.bedroomb_mild_outside_threshold",
      ventiOffset: "input_number.bedroomb_venti_in_offset",
      roomBatt: "input_number.bedroomb_room_sensor_min_battery",
      outsideBatt: "input_number.bedroomb_outside_sensor_min_battery",
    },
  },
};

const timeDefaults = [
  ["Night Start", "night_start", "00:30:00"],
  ["Day Start", "day_start", "08:30:00"],
  ["Air Clean Start", "air_clean_start", "03:00:00"],
  ["Air Clean End", "air_clean_end", "06:00:00"],
];

function setupBlock(prefix, current) {
  const marker = `{% set ${prefix}_night_start_value = states('input_datetime.${prefix}_night_start')`;
  if (current.includes(marker)) return current;
  return current.replace(
    /{% set minutes_now = now\(\)\.hour \* 60 \+ now\(\)\.minute %}\n{% set night_sleep_window = minutes_now >= 30 and minutes_now < 510 %}\n{% set night_air_clean_window = minutes_now >= 180 and minutes_now < 360 %}\n{% set night_window = night_air_clean_window %}\n{% set day_air_clean_window = now\(\)\.hour >= 8 and now\(\)\.hour <= 23 %}/,
    `{% set ${prefix}_night_start_value = states('input_datetime.${prefix}_night_start') if states('input_datetime.${prefix}_night_start') not in ['unknown', 'unavailable', 'none'] else '00:30:00' %}
{% set ${prefix}_day_start_value = states('input_datetime.${prefix}_day_start') if states('input_datetime.${prefix}_day_start') not in ['unknown', 'unavailable', 'none'] else '08:30:00' %}
{% set ${prefix}_air_clean_start_value = states('input_datetime.${prefix}_air_clean_start') if states('input_datetime.${prefix}_air_clean_start') not in ['unknown', 'unavailable', 'none'] else '03:00:00' %}
{% set ${prefix}_air_clean_end_value = states('input_datetime.${prefix}_air_clean_end') if states('input_datetime.${prefix}_air_clean_end') not in ['unknown', 'unavailable', 'none'] else '06:00:00' %}
{% set ${prefix}_night_start_parts = ${prefix}_night_start_value.split(':') %}
{% set ${prefix}_day_start_parts = ${prefix}_day_start_value.split(':') %}
{% set ${prefix}_air_clean_start_parts = ${prefix}_air_clean_start_value.split(':') %}
{% set ${prefix}_air_clean_end_parts = ${prefix}_air_clean_end_value.split(':') %}
{% set night_start_minutes = (${prefix}_night_start_parts[0] | int) * 60 + (${prefix}_night_start_parts[1] | int) %}
{% set day_start_minutes = (${prefix}_day_start_parts[0] | int) * 60 + (${prefix}_day_start_parts[1] | int) %}
{% set air_clean_start_minutes = (${prefix}_air_clean_start_parts[0] | int) * 60 + (${prefix}_air_clean_start_parts[1] | int) %}
{% set air_clean_end_minutes = (${prefix}_air_clean_end_parts[0] | int) * 60 + (${prefix}_air_clean_end_parts[1] | int) %}
{% set minutes_now = now().hour * 60 + now().minute %}
{% set night_sleep_window = (minutes_now >= night_start_minutes and minutes_now < day_start_minutes) if night_start_minutes < day_start_minutes else (minutes_now >= night_start_minutes or minutes_now < day_start_minutes) %}
{% set night_air_clean_window = (minutes_now >= air_clean_start_minutes and minutes_now < air_clean_end_minutes) if air_clean_start_minutes < air_clean_end_minutes else (minutes_now >= air_clean_start_minutes or minutes_now < air_clean_end_minutes) %}
{% set night_window = night_air_clean_window %}
{% set day_air_clean_window = minutes_now >= day_start_minutes and minutes_now <= 1439 %}`,
  );
}

function replaceSetupTemplates(config, prefix) {
  function walk(value) {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out = {};
      for (const [key, child] of Object.entries(value)) out[key] = walk(child);
      return out;
    }
    if (typeof value !== "string") return value;
    if (!value.startsWith("{% set")) return value;
    return setupBlock(prefix, value);
  }
  return walk(config);
}

async function createOrUpdateTimeHelpers(ws) {
  let id = 1000;
  const list = await ws.request({ id: ++id, type: "input_datetime/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const byId = new Map(list.result.map((helper) => [helper.id, helper]));
  const changed = [];
  for (const prefix of Object.keys(rooms)) {
    for (const [label, suffix, time] of timeDefaults) {
      const helperId = `${prefix}_${suffix}`;
      const name = `${rooms[prefix].title} ${label}`;
      const payload = {
        id: ++id,
        name,
        has_date: false,
        has_time: true,
      };
      if (byId.has(helperId)) {
        const res = await ws.request({ ...payload, type: "input_datetime/update", input_datetime_id: helperId });
        if (!res.success) throw new Error(JSON.stringify(res));
        changed.push(`updated input_datetime.${helperId}`);
      } else {
        const res = await ws.request({ ...payload, type: "input_datetime/create", id: ++id });
        if (!res.success) throw new Error(JSON.stringify(res));
        changed.push(`created input_datetime.${helperId}`);
      }
      await rest("/api/services/input_datetime/set_datetime", "POST", {
        entity_id: `input_datetime.${helperId}`,
        time,
      });
    }
  }
  return changed;
}

function roomDiagram(room) {
  return `\`\`\`mermaid
flowchart TD
  A["Trigger: every 5m / sensor / schedule"] --> B["Read room sensors + climate sensor"]
  B --> C["Pick temperature source"]
  C --> D["Read outside temp: Venti In - offset -> weather -> venti fallback"]
  D --> E{"Season mode"}
  E -->|"outside <= winter threshold"| W["Winter target"]
  E -->|"outside >= summer threshold"| S["Summer target"]
  E -->|"between thresholds"| N["Neutral: no comfort action"]
  S --> T{"Time window"}
  W --> T
  T -->|"Air clean window"| F["fan_only + fan 5"]
  T -->|"Night window"| NT["Night targets / energy saving band"]
  T -->|"Day window"| DT["Day comfort band"]
  NT --> C1{"Room outside band?"}
  DT --> C1
  C1 -->|"Too warm in summer"| COOL["cool with dynamic setpoint"]
  C1 -->|"Too cold in winter"| HEAT["heat with dynamic setpoint"]
  C1 -->|"Inside band"| OFF["off"]
  COOL --> CD["fan_only coil cool-down"]
  CD --> LEARN["update learned overshoot"]
  LEARN --> OFF
\`\`\`

Dynamic setpoint = climate sensor temperature - (selected room temperature - target).`;
}

function statusMarkdown(room) {
  return `### ${room.title} control loop

Climate: \`${room.climate}\`  
Automation: \`${room.automation}\`  
Main sensor: \`${room.tempSensors[0]}\``;
}

function roomView(room) {
  const h = room.helpers;
  const nightEntities = room.title === "BedroomB"
    ? [h.nightSummer, h.nightCoolDelta, h.nightWinter, h.nightWinterDelta]
    : [];
  return {
    title: room.viewTitle,
    path: room.path,
    icon: room.icon,
    cards: [
      {
        type: "markdown",
        content: statusMarkdown(room),
      },
      {
        type: "horizontal-stack",
        cards: [
          { type: "button", entity: room.automation, name: "Program", icon: "mdi:robot", show_state: true, tap_action: { action: "toggle" } },
          { type: "button", entity: room.climate, name: "Aircon", icon: "mdi:air-conditioner", show_state: true, tap_action: { action: "more-info" } },
          { type: "button", entity: room.power, name: "Power", icon: "mdi:power-plug", show_state: true, tap_action: { action: "toggle" } },
        ],
      },
      {
        type: "thermostat",
        entity: room.climate,
        name: `${room.title} manual`,
      },
      {
        type: "gauge",
        entity: room.target,
        name: "Target",
        min: 18,
        max: 30,
        severity: { green: 22, yellow: 25, red: 28 },
      },
      {
        type: "entities",
        title: "Primary",
        entities: [
          room.target,
          h.coolDelta,
          h.fan,
          h.cooldown,
          h.overshoot,
        ].filter(Boolean),
      },
      {
        type: "entities",
        title: "Schedule",
        entities: [
          `input_datetime.${room === rooms.livingr ? "livingr" : "bedroomb"}_night_start`,
          `input_datetime.${room === rooms.livingr ? "livingr" : "bedroomb"}_day_start`,
          `input_datetime.${room === rooms.livingr ? "livingr" : "bedroomb"}_air_clean_start`,
          `input_datetime.${room === rooms.livingr ? "livingr" : "bedroomb"}_air_clean_end`,
        ],
      },
      ...(nightEntities.length ? [{
        type: "entities",
        title: "Night",
        entities: nightEntities,
      }] : []),
      {
        type: "entities",
        title: "Season",
        entities: [h.hot, h.winter, h.winterDelta, h.summerOut, h.winterOut, h.mildOut].filter(Boolean),
      },
      {
        type: "entities",
        title: "Sensors",
        entities: [
          ...room.tempSensors,
          "sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor",
          "sensor.miaomiaoce_t2_56fa_battery_level",
          "weather.forecast_home",
        ],
      },
      {
        type: "entities",
        title: "Advanced",
        entities: [h.ventiOffset, h.roomBatt, h.outsideBatt].filter(Boolean),
      },
      {
        type: "entities",
        title: "Electricity",
        entities: [room.energy, room.power, "sensor.total_consumption_power"],
      },
      {
        type: "history-graph",
        title: "Temperature history",
        hours_to_show: 24,
        entities: [room.climate, ...room.tempSensors.filter((e) => e.includes("temperature"))],
      },
      {
        type: "history-graph",
        title: "Energy history",
        hours_to_show: 168,
        entities: [room.energy],
      },
      {
        type: "markdown",
        title: "Program cycle",
        content: roomDiagram(room),
      },
    ],
  };
}

function removeRoomButtons(view) {
  if (!view.cards) return;
  view.cards = view.cards.filter((card) => {
    if (card.type !== "button") return true;
    return !["LivingR Tune", "BedroomB Tune", "Living Tune", "BedB Tune"].includes(card.name);
  });
}

(async () => {
  const ws = await connectWs();
  const timeChanges = await createOrUpdateTimeHelpers(ws);

  const liveLiving = await rest("/api/config/automation/config/1770077000010");
  await rest("/api/config/automation/config/1770077000010", "POST", replaceSetupTemplates(liveLiving, "livingr"));
  const liveBedroom = await rest("/api/config/automation/config/1770077000021");
  await rest("/api/config/automation/config/1770077000021", "POST", replaceSetupTemplates(liveBedroom, "bedroomb"));
  await rest("/api/services/automation/reload", "POST", {});

  let id = 2000;
  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!lovelace.success) throw new Error(JSON.stringify(lovelace));
  const config = lovelace.result;

  const viewByPath = new Map(config.views.map((v, i) => [v.path || v.title, i]));
  for (const room of Object.values(rooms)) {
    const view = roomView(room);
    const oldIdx = config.views.findIndex((v) => [room.path, `${room.path}-tuning`, room.viewTitle, `${room.title} Tune`].includes(v.path) || [room.viewTitle, `${room.title} Tune`, room.title].includes(v.title));
    if (oldIdx >= 0) config.views[oldIdx] = view;
    else config.views.push(view);
  }

  const home = config.views.find((v) => v.path === "default_view" || v.title === "Default" || v.path === "home" || v.title === "Home") || config.views[0];
  removeRoomButtons(home);
  home.cards = home.cards || [];
  home.cards.unshift({
    type: "horizontal-stack",
    cards: [
      { type: "button", name: "Living", icon: "mdi:sofa", tap_action: { action: "navigate", navigation_path: "/my-dash/living" } },
      { type: "button", name: "BedB", icon: "mdi:bed-king-outline", tap_action: { action: "navigate", navigation_path: "/my-dash/bedb" } },
    ],
  });

  for (const view of config.views) {
    if (view === home) continue;
    removeRoomButtons(view);
  }

  const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config });
  if (!save.success) throw new Error(JSON.stringify(save));
  ws.close();

  const states = await rest("/api/states");
  const interesting = [
    "input_datetime.livingr_night_start",
    "input_datetime.livingr_day_start",
    "input_datetime.bedroomb_night_start",
    "input_datetime.bedroomb_day_start",
    rooms.livingr.automation,
    rooms.bedroomb.automation,
    rooms.bedroomb.tempSensors[0],
    rooms.bedroomb.tempSensors[2],
    rooms.bedroomb.climate,
  ];
  console.log(JSON.stringify({
    timeChanges,
    dashboardPaths: ["/my-dash/living", "/my-dash/bedb"],
    states: Object.fromEntries(states.filter((s) => interesting.includes(s.entity_id)).map((s) => [s.entity_id, s.state])),
  }, null, 2));
})();
