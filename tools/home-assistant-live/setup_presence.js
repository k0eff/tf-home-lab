const { connectWs, rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000051";
const AUTOMATION_ALIAS = "Presence - fused home detection";
const TAG_AWAY_AUTOMATION_ID = "168263075795099";
const TAG_HOME_AUTOMATION_ID = "168262953150899";
const DASHBOARD_PATH = "my-dash";
const DEFAULT_VIEW_PATH = "default";
const PRESENCE_VIEW_PATH = "presence";
const PRESENCE_VIEW_TITLE = "Presence";
const HOME_SSID = "512KB";
const HOME_PUBLIC_IP = "151.251.104.115";
const HOME_BSSIDS = ["9c:9d:7e:75:21:a1", "9c:9d:7e:75:21:a0"];

const HELPERS = [
  {
    entity_id: "input_boolean.presence_krasimir_koev",
    name: "Presence Krasimir Koev",
    icon: "mdi:account",
  },
  {
    entity_id: "input_boolean.presence_ema_yosifova",
    name: "Presence Ema Yosifova",
    icon: "mdi:account",
  },
  {
    entity_id: "input_boolean.someone_home",
    name: "Someone Home",
    icon: "mdi:home-account",
  },
  {
    entity_id: "input_boolean.internet_connection",
    name: "Internet Connection",
    icon: "mdi:web",
  },
];

const DATETIME_HELPERS = [
  {
    entity_id: "input_datetime.presence_away_tag_until",
    name: "Presence Away Tag Until",
    icon: "mdi:tag-off",
    has_date: true,
    has_time: true,
  },
];

const WATCH_ENTITIES = [
  "device_tracker.fold_4",
  "sensor.fold_4_wifi_connection",
  "sensor.fold_4_wifi_bssid",
  "sensor.fold_4_public_ip_address",
  "device_tracker.iphone",
  "sensor.iphone15promax_ssid",
  "sensor.iphone15promax_bssid",
  "sensor.iphone15promax_connection_type",
  "input_datetime.presence_away_tag_until",
  "weather.forecast_home",
  "binary_sensor.motion01",
  "binary_sensor.motion03",
  "binary_sensor.motion04spalniam",
];

const BSSID_LIST = `['${HOME_BSSIDS.join("', '")}']`;
const FOLD_GPS_HOME = "(states('device_tracker.fold_4') | lower == 'home')";
const EMA_GPS_HOME = "(states('device_tracker.iphone') | lower == 'home')";
const FOLD_WIFI_HOME = `(states('sensor.fold_4_wifi_connection') == '${HOME_SSID}' or states('sensor.fold_4_wifi_bssid') in ${BSSID_LIST})`;
const EMA_WIFI_HOME = `((states('sensor.iphone15promax_connection_type') == 'Wi-Fi') and (states('sensor.iphone15promax_ssid') == '${HOME_SSID}' or states('sensor.iphone15promax_bssid') in ${BSSID_LIST}))`;
const FOLD_LOCAL_AWAY_30M = `((not (${FOLD_WIFI_HOME})) and (as_timestamp(now()) - ([as_timestamp(states.sensor.fold_4_wifi_connection.last_changed, 0), as_timestamp(states.sensor.fold_4_wifi_bssid.last_changed, 0)] | max)) > 1800)`;
const EMA_LOCAL_AWAY_30M = `((not (${EMA_WIFI_HOME})) and (states('sensor.iphone15promax_connection_type') in ['Cellular', 'Not Connected'] or states('sensor.iphone15promax_ssid') == 'Not Connected' or states('sensor.iphone15promax_bssid') == 'Not Connected') and (as_timestamp(now()) - ([as_timestamp(states.sensor.iphone15promax_connection_type.last_changed, 0), as_timestamp(states.sensor.iphone15promax_ssid.last_changed, 0), as_timestamp(states.sensor.iphone15promax_bssid.last_changed, 0)] | max)) > 1800)`;
const TAG_AWAY_ACTIVE = `(states('input_datetime.presence_away_tag_until') not in ['unknown', 'unavailable', 'none'] and as_timestamp(states('input_datetime.presence_away_tag_until'), 0) > as_timestamp(now()))`;
const ANY_HOME_WIFI = `(${FOLD_WIFI_HOME} or ${EMA_WIFI_HOME})`;
const WEATHER_FRESH = "(states('weather.forecast_home') not in ['unknown', 'unavailable', 'none'] and (as_timestamp(now()) - as_timestamp(states.weather.forecast_home.last_updated, 0)) < 7200)";
const INTERNET_UP = `(states('sensor.fold_4_public_ip_address') == '${HOME_PUBLIC_IP}' or (${ANY_HOME_WIFI} and ${WEATHER_FRESH}))`;
const KRASIMIR_HOME_UP = `((not (${TAG_AWAY_ACTIVE})) and (${FOLD_WIFI_HOME} or ${FOLD_GPS_HOME}))`;
const EMA_HOME_UP = `((not (${TAG_AWAY_ACTIVE})) and (${EMA_WIFI_HOME} or ${EMA_GPS_HOME}))`;
const KRASIMIR_HOME_DOWN = `((not (${TAG_AWAY_ACTIVE})) and (${FOLD_WIFI_HOME} or ${FOLD_GPS_HOME} or is_state('input_boolean.presence_krasimir_koev', 'on')))`;
const EMA_HOME_DOWN = `((not (${TAG_AWAY_ACTIVE})) and (${EMA_WIFI_HOME} or ${EMA_GPS_HOME} or is_state('input_boolean.presence_ema_yosifova', 'on')))`;
const MOTION_PRESENT = "(is_state('binary_sensor.motion01', 'on') or is_state('binary_sensor.motion03', 'on') or is_state('binary_sensor.motion04spalniam', 'on'))";

function helperId(entityId) {
  return entityId.replace(/^[^.]+\./, "");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function booleanSetter(entityId, expression) {
  return {
    choose: [
      {
        conditions: [
          {
            condition: "template",
            value_template: `{{ ${expression} }}`,
          },
        ],
        sequence: [
          {
            service: "input_boolean.turn_on",
            target: { entity_id: entityId },
          },
        ],
      },
    ],
    default: [
      {
        service: "input_boolean.turn_off",
        target: { entity_id: entityId },
      },
    ],
  };
}

function presenceAutomation() {
  return {
    id: AUTOMATION_ID,
    alias: AUTOMATION_ALIAS,
    description: "Fused home detection for Krasimir and Ema. Combines GPS, Wi-Fi SSID/BSSID, Fold 4 public IP, and a weather freshness fallback. When the home internet looks down, each per-person helper locks to its last home state unless local Wi-Fi evidence still says home. someone_home also stays on from local motion.",
    mode: "restart",
    trigger: [
      { platform: "time_pattern", seconds: "/30" },
      { platform: "state", entity_id: WATCH_ENTITIES },
    ],
    condition: [],
    action: [
      booleanSetter("input_boolean.internet_connection", INTERNET_UP),
      booleanSetter(
        "input_boolean.presence_krasimir_koev",
        `((${INTERNET_UP}) and (${KRASIMIR_HOME_UP})) or ((not (${INTERNET_UP})) and (${KRASIMIR_HOME_DOWN}))`,
      ),
      booleanSetter(
        "input_boolean.presence_ema_yosifova",
        `((${INTERNET_UP}) and (${EMA_HOME_UP})) or ((not (${INTERNET_UP})) and (${EMA_HOME_DOWN}))`,
      ),
      booleanSetter(
        "input_boolean.someone_home",
        `(not (${TAG_AWAY_ACTIVE}) and (is_state('input_boolean.presence_krasimir_koev', 'on') or is_state('input_boolean.presence_ema_yosifova', 'on') or ${MOTION_PRESENT}))`,
      ),
    ],
  };
}

function quickStatusCard() {
  return {
    type: "entities",
    title: "Presence",
    state_color: true,
    show_header_toggle: false,
    entities: [
      { entity: "input_boolean.someone_home", name: "Someone home" },
      { entity: "input_boolean.presence_krasimir_koev", name: "Krasi" },
      { entity: "input_boolean.presence_ema_yosifova", name: "Ema" },
      { entity: "input_boolean.internet_connection", name: "Internet" },
    ],
  };
}

function detailedMetricsCard() {
  return {
    type: "markdown",
    content: `<!-- presence-dashboard-card -->
## Presence diagnostics

**Internet:** {% if is_state('input_boolean.internet_connection', 'on') %}🟢 online{% else %}🔴 offline / locked{% endif %}  
**Someone home:** {% if is_state('input_boolean.someone_home', 'on') %}🟢 yes{% else %}🔴 no{% endif %}

| Signal | Krasi | Ema |
| --- | --- | --- |
| Fused presence | {% if is_state('input_boolean.presence_krasimir_koev', 'on') %}🟢 home{% else %}🔴 away{% endif %} | {% if is_state('input_boolean.presence_ema_yosifova', 'on') %}🟢 home{% else %}🔴 away{% endif %} |
| GPS tracker | {{ states('device_tracker.fold_4') }} | {{ states('device_tracker.iphone') }} |
| Home Wi-Fi match | {% if ${FOLD_WIFI_HOME} %}📶 yes{% else %}❌ no{% endif %} | {% if ${EMA_WIFI_HOME} %}📶 yes{% else %}❌ no{% endif %} |
| SSID | {{ states('sensor.fold_4_wifi_connection') }} | {{ states('sensor.iphone15promax_ssid') }} |
| BSSID | {{ states('sensor.fold_4_wifi_bssid') }} | {{ states('sensor.iphone15promax_bssid') }} |
| Public IP | {{ states('sensor.fold_4_public_ip_address') }} | n/a |
| Connection type | n/a | {{ states('sensor.iphone15promax_connection_type') }} |
| Local away >30m | {% if ${FOLD_LOCAL_AWAY_30M} %}yes{% else %}no{% endif %} | {% if ${EMA_LOCAL_AWAY_30M} %}yes{% else %}no{% endif %} |

**Away tag force window:** {% if ${TAG_AWAY_ACTIVE} %}active until {{ states('input_datetime.presence_away_tag_until') }}{% else %}inactive{% endif %}<br>
**Motion fallback:** motion01={{ states('binary_sensor.motion01') }}, motion03={{ states('binary_sensor.motion03') }}, motion04spalniam={{ states('binary_sensor.motion04spalniam') }}  
**Weather freshness fallback:** {% if ${WEATHER_FRESH} %}🟢 fresh{% else %}🔴 stale{% endif %} · weather={{ states('weather.forecast_home') }}`,
  };
}

function isPresenceStatusCard(card) {
  return card.type === "entities"
    && card.title === "Presence"
    && Array.isArray(card.entities)
    && card.entities.some((entry) => (typeof entry === "string" ? entry : entry.entity) === "input_boolean.someone_home");
}

function isPresenceDetailsCard(card) {
  return card.type === "markdown"
    && typeof card.content === "string"
    && card.content.includes("presence-dashboard-card");
}

function presenceShortcutCard() {
  return {
    show_name: true,
    show_icon: true,
    type: "button",
    tap_action: {
      action: "navigate",
      navigation_path: `/my-dash/${PRESENCE_VIEW_PATH}`,
    },
    name: PRESENCE_VIEW_TITLE,
    icon: "mdi:account-group",
  };
}

function isPresenceShortcutCard(card) {
  return card.type === "button"
    && card.name === PRESENCE_VIEW_TITLE
    && card.tap_action
    && card.tap_action.action === "navigate"
    && card.tap_action.navigation_path === `/my-dash/${PRESENCE_VIEW_PATH}`;
}

function presenceView() {
  return {
    title: PRESENCE_VIEW_TITLE,
    path: PRESENCE_VIEW_PATH,
    icon: "mdi:account-group",
    cards: [
      quickStatusCard(),
      detailedMetricsCard(),
    ],
  };
}

function awayTagSetUntilAction() {
  return {
    service: "input_datetime.set_datetime",
    target: { entity_id: "input_datetime.presence_away_tag_until" },
    data: {
      datetime: "{{ (now() + timedelta(minutes=60)).strftime('%Y-%m-%d %H:%M:%S') }}",
    },
  };
}

function homeTagClearAwayAction() {
  return {
    service: "input_datetime.set_datetime",
    target: { entity_id: "input_datetime.presence_away_tag_until" },
    data: {
      datetime: "{{ now().strftime('%Y-%m-%d %H:%M:%S') }}",
    },
  };
}

function isAwayTagUntilAction(action) {
  return action?.service === "input_datetime.set_datetime"
    && action?.target?.entity_id === "input_datetime.presence_away_tag_until";
}

async function patchTagAutomation(id, actionFactory) {
  const config = await rest(`/api/config/automation/config/${id}`);
  const actions = Array.isArray(config.action) ? config.action : [];
  config.action = [
    actionFactory(),
    ...actions.filter((action) => !isAwayTagUntilAction(action)),
  ];
  await rest(`/api/config/automation/config/${id}`, "POST", config);
  return {
    id,
    alias: config.alias,
    action_count: config.action.length,
  };
}

function stableCardSignature(card) {
  return JSON.stringify(card);
}

function dedupeCards(cards) {
  const seen = new Set();
  const output = [];
  for (const card of cards || []) {
    const signature = stableCardSignature(card);
    if (seen.has(signature)) continue;
    seen.add(signature);
    output.push(card);
  }
  return output;
}

async function ensureInputBooleans(ws) {
  let id = 100;
  const list = await ws.request({ id: ++id, type: "input_boolean/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = new Map(list.result.map((item) => [item.id, item]));
  const changed = [];

  for (const helper of HELPERS) {
    const current = existing.get(helperId(helper.entity_id));
    const payload = {
      id: ++id,
      name: helper.name,
      icon: helper.icon,
    };
    const result = current
      ? await ws.request({ ...payload, type: "input_boolean/update", input_boolean_id: helperId(helper.entity_id) })
      : await ws.request({ ...payload, type: "input_boolean/create" });
    if (!result.success) throw new Error(JSON.stringify(result));
    changed.push(`${current ? "updated" : "created"} ${helper.entity_id}`);
  }

  return changed;
}

async function ensureInputDatetimes(ws) {
  let id = 200;
  const list = await ws.request({ id: ++id, type: "input_datetime/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = new Map(list.result.map((item) => [item.id, item]));
  const changed = [];

  for (const helper of DATETIME_HELPERS) {
    const current = existing.get(helperId(helper.entity_id));
    const payload = {
      id: ++id,
      name: helper.name,
      icon: helper.icon,
      has_date: helper.has_date,
      has_time: helper.has_time,
    };
    const result = current
      ? await ws.request({ ...payload, type: "input_datetime/update", input_datetime_id: helperId(helper.entity_id) })
      : await ws.request({ ...payload, type: "input_datetime/create" });
    if (!result.success) throw new Error(JSON.stringify(result));
    changed.push(`${current ? "updated" : "created"} ${helper.entity_id}`);
  }

  return changed;
}

async function patchDashboard(ws) {
  let id = 400;
  const configResp = await ws.request({ id: ++id, type: "lovelace/config", url_path: DASHBOARD_PATH });
  if (!configResp.success) throw new Error(JSON.stringify(configResp));
  const config = configResp.result;
  const defaultView = (config.views || []).find((item) => item.path === DEFAULT_VIEW_PATH);
  if (!defaultView) throw new Error(`Missing Lovelace view ${DEFAULT_VIEW_PATH}`);

  defaultView.cards = (defaultView.cards || []).filter(
    (card) => !isPresenceStatusCard(card) && !isPresenceDetailsCard(card) && !isPresenceShortcutCard(card),
  );
  defaultView.cards.push(presenceShortcutCard());
  defaultView.cards = dedupeCards(defaultView.cards);

  const existingPresenceView = (config.views || []).find((item) => item.path === PRESENCE_VIEW_PATH);
  if (existingPresenceView) {
    existingPresenceView.title = PRESENCE_VIEW_TITLE;
    existingPresenceView.icon = "mdi:account-group";
    existingPresenceView.cards = presenceView().cards;
  } else {
    config.views = config.views || [];
    config.views.push(presenceView());
  }

  const save = await ws.request({
    id: ++id,
    type: "lovelace/config/save",
    url_path: DASHBOARD_PATH,
    config,
  });
  if (!save.success) throw new Error(JSON.stringify(save));

  return {
    defaultView: {
      path: defaultView.path,
      cards: defaultView.cards.length,
    },
    presenceView: {
      path: PRESENCE_VIEW_PATH,
      cards: 2,
    },
  };
}

(async () => {
  const ws = await connectWs();
  const helperChanges = await ensureInputBooleans(ws);
  const datetimeChanges = await ensureInputDatetimes(ws);
  const dashboard = await patchDashboard(ws);
  ws.close();

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", presenceAutomation());
  const tagAway = await patchTagAutomation(TAG_AWAY_AUTOMATION_ID, awayTagSetUntilAction);
  const tagHome = await patchTagAutomation(TAG_HOME_AUTOMATION_ID, homeTagClearAwayAction);
  await rest("/api/services/automation/reload", "POST", {});
  const automationEntityId = `automation.${slugify(AUTOMATION_ALIAS)}`;
  await rest("/api/services/automation/turn_on", "POST", {
    entity_id: automationEntityId,
  }).catch(() => null);
  await rest("/api/services/automation/trigger", "POST", {
    entity_id: automationEntityId,
    skip_condition: false,
  }).catch(() => null);

  const states = await rest("/api/states");
  const summaryEntities = new Set([
    ...HELPERS.map((helper) => helper.entity_id),
    ...DATETIME_HELPERS.map((helper) => helper.entity_id),
    automationEntityId,
  ]);
  const summary = Object.fromEntries(
    states
      .filter((item) => summaryEntities.has(item.entity_id))
      .map((item) => [item.entity_id, item.state]),
  );

  console.log(JSON.stringify({
    helperChanges,
    datetimeChanges,
    tagAway,
    tagHome,
    dashboard,
    summary,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
