/**
 * setup_fan_boost.js
 *
 * Adds temporary fan boost controls to the Lossnay ventilation section
 * of the my-dash/aircon panel.
 *
 * Creates:
 *   - input_boolean.venti_fan_boost_active
 *   - input_datetime.venti_fan_boost_until
 *   - input_button.venti_fan_boost_30m
 *   - input_button.venti_fan_boost_60m
 *   - automation [TEST] Lossnay - fan boost (id: 1770077000051)
 *   - two boost status + control cards after "Lossnay Ventilation" in aircon view
 *
 * Does NOT touch the living or bedb views.
 */

const { connectWs, rest } = require("./ha_ws_util");

const VENTI_FAN_SPEED = "select.venti_fan_speed";
const BOOST_LEVEL = "4";
const NORMAL_LEVEL = "2";
const BOOST_AUTOMATION_ID = "1770077000052";
const BOOST_AUTOMATION_ALIAS = "[TEST] Lossnay - fan boost";

const ACTIVE = "input_boolean.lossnay_fan_boost_active";
const UNTIL = "input_datetime.lossnay_fan_boost_until";
const BTN_30 = "input_button.lossnay_fan_boost_30m";
const BTN_60 = "input_button.lossnay_fan_boost_60m";

let seq = 300;
const nextId = () => ++seq;

async function ensureInputBoolean(ws, entity, name, icon) {
  const list = await ws.request({ id: nextId(), type: "input_boolean/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const helperId = entity.replace(/^[^.]+\./, "");
  const existing = list.result.find((item) => item.id === helperId);
  const payload = { id: nextId(), name, icon };
  const res = existing
    ? await ws.request({ ...payload, type: "input_boolean/update", input_boolean_id: helperId })
    : await ws.request({ ...payload, type: "input_boolean/create" });
  if (!res.success) throw new Error(`${entity}: ${JSON.stringify(res)}`);
  return existing ? "updated" : "created";
}

async function ensureInputDatetime(ws, entity, name) {
  const list = await ws.request({ id: nextId(), type: "input_datetime/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const helperId = entity.replace(/^[^.]+\./, "");
  const existing = list.result.find((item) => item.id === helperId);
  const payload = { id: nextId(), name, has_date: true, has_time: true, icon: "mdi:timer-sand" };
  const res = existing
    ? await ws.request({ ...payload, type: "input_datetime/update", input_datetime_id: helperId })
    : await ws.request({ ...payload, type: "input_datetime/create" });
  if (!res.success) throw new Error(`${entity}: ${JSON.stringify(res)}`);
  return existing ? "updated" : "created";
}

async function ensureInputButton(ws, entity, name, icon) {
  const list = await ws.request({ id: nextId(), type: "input_button/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const helperId = entity.replace(/^[^.]+\./, "");
  const existing = list.result.find((item) => item.id === helperId);
  const payload = { id: nextId(), name, icon };
  const res = existing
    ? await ws.request({ ...payload, type: "input_button/update", input_button_id: helperId })
    : await ws.request({ ...payload, type: "input_button/create" });
  if (!res.success) throw new Error(`${entity}: ${JSON.stringify(res)}`);
  return existing ? "updated" : "created";
}

function boostAutomation() {
  const setFan = (level) => ({
    service: "select.select_option",
    target: { entity_id: VENTI_FAN_SPEED },
    data: { option: level },
  });

  return {
    alias: BOOST_AUTOMATION_ALIAS,
    description: `Temporarily sets Lossnay fan speed to ${BOOST_LEVEL} for 30 or 60 min, then restores to ${NORMAL_LEVEL}.`,
    mode: "restart",
    trigger: [
      { platform: "state", entity_id: BTN_30, id: "boost_30m" },
      { platform: "state", entity_id: BTN_60, id: "boost_60m" },
      { platform: "state", entity_id: ACTIVE, to: "off", id: "boost_cancelled" },
      { platform: "time_pattern", minutes: "/1", id: "boost_expiry_check" },
    ],
    action: [
      {
        choose: [
          {
            alias: "Activate 30min boost",
            conditions: [{ condition: "template", value_template: "{{ trigger.id == 'boost_30m' }}" }],
            sequence: [
              { service: "input_datetime.set_datetime", target: { entity_id: UNTIL }, data: { datetime: "{{ (now() + timedelta(minutes=30)).strftime('%Y-%m-%d %H:%M:%S') }}" } },
              { service: "input_boolean.turn_on", target: { entity_id: ACTIVE } },
              setFan(BOOST_LEVEL),
              { service: "logbook.log", data: { name: "Lossnay fan boost", message: `Boost started: speed ${BOOST_LEVEL} for 30 minutes`, entity_id: VENTI_FAN_SPEED } },
            ],
          },
          {
            alias: "Activate 60min boost",
            conditions: [{ condition: "template", value_template: "{{ trigger.id == 'boost_60m' }}" }],
            sequence: [
              { service: "input_datetime.set_datetime", target: { entity_id: UNTIL }, data: { datetime: "{{ (now() + timedelta(minutes=60)).strftime('%Y-%m-%d %H:%M:%S') }}" } },
              { service: "input_boolean.turn_on", target: { entity_id: ACTIVE } },
              setFan(BOOST_LEVEL),
              { service: "logbook.log", data: { name: "Lossnay fan boost", message: `Boost started: speed ${BOOST_LEVEL} for 60 minutes`, entity_id: VENTI_FAN_SPEED } },
            ],
          },
          {
            alias: "Expire boost",
            conditions: [{
              condition: "template",
              value_template: `{{ trigger.id == 'boost_expiry_check' and is_state('${ACTIVE}', 'on') and states('${UNTIL}') not in ['unknown', 'unavailable', 'none'] and as_timestamp(states('${UNTIL}'), 0) <= as_timestamp(now()) }}`,
            }],
            sequence: [
              setFan(NORMAL_LEVEL),
              { service: "input_boolean.turn_off", target: { entity_id: ACTIVE } },
              { service: "logbook.log", data: { name: "Lossnay fan boost", message: `Boost expired; speed restored to ${NORMAL_LEVEL}`, entity_id: VENTI_FAN_SPEED } },
            ],
          },
          {
            alias: "Cancel boost",
            conditions: [{ condition: "template", value_template: "{{ trigger.id == 'boost_cancelled' }}" }],
            sequence: [
              setFan(NORMAL_LEVEL),
              { service: "logbook.log", data: { name: "Lossnay fan boost", message: `Boost cancelled; speed restored to ${NORMAL_LEVEL}`, entity_id: VENTI_FAN_SPEED } },
            ],
          },
        ],
      },
    ],
  };
}

function boostStatusCard() {
  return {
    type: "markdown",
    content: `### Lossnay fan boost
{% set active = is_state('${ACTIVE}', 'on') %}
{% set until = states('${UNTIL}') %}
{% set current_speed = states('${VENTI_FAN_SPEED}') %}
{% set running = active and until not in ['unknown', 'unavailable', 'none'] and as_timestamp(until, 0) > as_timestamp(now()) %}
{% if running %}
{% set remaining = ((as_timestamp(until, 0) - as_timestamp(now())) / 60) | round(0) %}
<ha-alert alert-type="warning">Boost active — speed {{ current_speed }} — {{ remaining }}min remaining (until {{ as_timestamp(until, 0) | timestamp_custom('%H:%M') }})</ha-alert>
{% elif current_speed == '${NORMAL_LEVEL}' %}
<ha-alert alert-type="success">Normal speed ({{ current_speed }})</ha-alert>
{% else %}
<ha-alert alert-type="info">Current speed: {{ current_speed }} (no active boost timer)</ha-alert>
{% endif %}`,
  };
}

function boostControlCard() {
  return {
    type: "horizontal-stack",
    cards: [
      {
        type: "button",
        entity: BTN_30,
        name: "Boost 30min",
        icon: "mdi:fan-plus",
        tap_action: { action: "call-service", service: "input_button.press", service_data: { entity_id: BTN_30 } },
      },
      {
        type: "button",
        entity: BTN_60,
        name: "Boost 60min",
        icon: "mdi:fan-plus",
        tap_action: { action: "call-service", service: "input_button.press", service_data: { entity_id: BTN_60 } },
      },
      {
        type: "button",
        entity: ACTIVE,
        name: "Stop boost",
        icon: "mdi:fan-off",
        tap_action: { action: "call-service", service: "input_boolean.turn_off", service_data: { entity_id: ACTIVE } },
      },
    ],
  };
}

function isLossnayCard(card) {
  return card.type === "entities" && card.title === "Lossnay Ventilation";
}

function isBoostStatusCard(card) {
  return card.type === "markdown" && String(card.content || "").includes("fan_boost");
}

function isBoostControlCard(card) {
  return card.type === "horizontal-stack" && (card.cards || []).some((c) => String(c.entity || "").includes("fan_boost"));
}

function isLossnayStack(card) {
  return card.type === "vertical-stack" && (card.cards || []).some(isLossnayCard);
}

async function patchDashboard(ws) {
  let id = 9200;
  const res = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!res.success) throw new Error(JSON.stringify(res));
  const dash = res.result;

  const aircon = dash.views.find((v) => v.path === "aircon");
  if (!aircon) throw new Error("aircon view not found in my-dash");

  let cards = aircon.cards || [];

  // Pull the Lossnay entities card out of a prior vertical-stack (idempotent re-run) or top level
  const existingStackIdx = cards.findIndex(isLossnayStack);
  let lossnayCard;
  if (existingStackIdx >= 0) {
    lossnayCard = cards[existingStackIdx].cards.find(isLossnayCard);
    cards.splice(existingStackIdx, 1);
  } else {
    const topLevelIdx = cards.findIndex(isLossnayCard);
    if (topLevelIdx < 0) throw new Error("Lossnay Ventilation card not found in aircon view");
    lossnayCard = cards[topLevelIdx];
    cards.splice(topLevelIdx, 1);
  }

  // Drop any stray boost cards left over from earlier (pre-stack) layout
  cards = cards.filter((card) => !isBoostStatusCard(card) && !isBoostControlCard(card));

  // masonry view distributes cards by column height; group Lossnay + boost
  // controls into one vertical-stack so they always render together.
  const lossnayStack = {
    type: "vertical-stack",
    cards: [lossnayCard, boostStatusCard(), boostControlCard()],
  };
  cards.splice(existingStackIdx >= 0 ? existingStackIdx : cards.length, 0, lossnayStack);

  aircon.cards = cards;

  const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config: dash });
  if (!save.success) throw new Error(JSON.stringify(save));
}

(async () => {
  const ws = await connectWs();

  console.log("Creating helpers...");
  const changes = {
    [ACTIVE]: await ensureInputBoolean(ws, ACTIVE, "Lossnay Fan Boost Active", "mdi:fan-alert"),
    [UNTIL]: await ensureInputDatetime(ws, UNTIL, "Lossnay Fan Boost Until"),
    [BTN_30]: await ensureInputButton(ws, BTN_30, "Lossnay Fan Boost 30m", "mdi:fan-plus"),
    [BTN_60]: await ensureInputButton(ws, BTN_60, "Lossnay Fan Boost 60m", "mdi:fan-plus"),
  };

  console.log("Writing boost automation...");
  await rest(`/api/config/automation/config/${BOOST_AUTOMATION_ID}`, "POST", boostAutomation());

  console.log("Reloading automations...");
  await rest("/api/services/automation/reload", "POST", {});

  console.log("Patching aircon view...");
  await patchDashboard(ws);

  ws.close();

  console.log(JSON.stringify({
    helpers: changes,
    automation: BOOST_AUTOMATION_ALIAS,
    boostLevel: BOOST_LEVEL,
    normalLevel: NORMAL_LEVEL,
    dashboard: "/my-dash/aircon (after Lossnay Ventilation card)",
  }, null, 2));
})();
