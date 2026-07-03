const { connectWs, rest } = require("./ha_ws_util");

// Xiaomi cloud (xiaomi_miot) has a recurring "get device udid error" failure mode
// where a sensor keeps reporting the exact same cached temperature for hours,
// only flickering to "unavailable" and back to that same cached value. HA's own
// last_changed resets on that unavailable flicker even though the reading never
// actually moved, so last_changed alone cannot detect this. These helpers track
// the last time each room sensor's numeric value genuinely moved by more than
// MOVE_EPSILON, independent of state-string churn.
const MOVE_EPSILON = 0.1;

const TRACKED_SENSORS = [
  {
    key: "livingr_room",
    entity_id: "sensor.miaomiaoce_t2_1228_temperature_humidity_sensor",
    trigger_id: "livingr_room_sensor_changed",
  },
  {
    key: "bedroomb_room_primary",
    entity_id: "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor",
    trigger_id: "bedroomb_room_primary_sensor_changed",
  },
  {
    key: "bedroomb_room_secondary",
    entity_id: "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor",
    trigger_id: "bedroomb_room_secondary_sensor_changed",
  },
];

const THRESHOLD_HELPERS = [
  { id: "livingr_room_sensor_stale_hours", name: "LivingR Room Sensor Stale Hours", min: 1, max: 12, step: 0.5, initial: 5 },
  { id: "livingr_room_ac_disagreement_threshold", name: "LivingR Room/AC Disagreement Threshold", min: 0.5, max: 5, step: 0.1, initial: 1.5, unit: "°C" },
  { id: "bedroomb_room_sensor_stale_hours", name: "BedroomB Room Sensor Stale Hours", min: 1, max: 12, step: 0.5, initial: 5 },
  { id: "bedroomb_room_ac_disagreement_threshold", name: "BedroomB Room/AC Disagreement Threshold", min: 0.5, max: 5, step: 0.1, initial: 1.5, unit: "°C" },
];

const TRACKER_AUTOMATION_ID = "1770077000099";
const TRACKER_ENTITY_ID = "automation.test_aircon_room_sensor_fluctuation_tracker";

async function ensureInputNumber(ws, { id, name, min, max, step, initial, unit }) {
  const list = await ws.request({ id: Date.now() % 100000, type: "input_number/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === id);
  const payload = {
    name,
    min,
    max,
    step,
    mode: "box",
    ...(unit ? { unit_of_measurement: unit } : {}),
  };
  if (existing) {
    const res = await ws.request({ id: Date.now() % 100000 + 1, type: "input_number/update", input_number_id: id, ...payload });
    if (!res.success) throw new Error(JSON.stringify(res));
    return "updated";
  }
  const res = await ws.request({ id: Date.now() % 100000 + 2, type: "input_number/create", ...payload });
  if (!res.success) throw new Error(JSON.stringify(res));
  await rest("/api/services/input_number/set_value", "POST", { entity_id: `input_number.${id}`, value: initial });
  return "created";
}

async function ensureInputDatetime(ws, id, name) {
  const list = await ws.request({ id: Date.now() % 100000 + 3, type: "input_datetime/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === id);
  const payload = { name, has_date: true, has_time: true };
  if (existing) return "exists";
  const res = await ws.request({ id: Date.now() % 100000 + 4, type: "input_datetime/create", ...payload });
  if (!res.success) throw new Error(JSON.stringify(res));
  return "created";
}

function trackerBranch(sensor) {
  return {
    alias: `Track ${sensor.key} fluctuation`,
    conditions: [
      {
        condition: "trigger",
        id: [sensor.trigger_id],
      },
      {
        condition: "template",
        value_template: `{{ trigger.to_state.state not in ['unknown', 'unavailable', 'none'] and (trigger.to_state.state | float(none)) is not none and ((trigger.to_state.state | float) - (states('input_number.${sensor.key}_last_seen_value') | float(trigger.to_state.state | float))) | abs >= ${MOVE_EPSILON} }}`,
      },
    ],
    sequence: [
      { service: "input_number.set_value", data: { entity_id: `input_number.${sensor.key}_last_seen_value`, value: `{{ trigger.to_state.state | float }}` } },
      { service: "input_datetime.set_datetime", data: { entity_id: `input_datetime.${sensor.key}_last_moved`, timestamp: "{{ as_timestamp(now()) }}" } },
    ],
  };
}

function trackerAutomationConfig() {
  return {
    alias: "[TEST] AirCon - room sensor fluctuation tracker",
    description:
      "Tracks the last time each cloud-backed Xiaomi room temperature sensor (LivingR, BedroomB primary, BedroomB secondary) genuinely changed value, independent of unavailable-flicker state churn. Feeds the staleness guard used by the room sensor comfort band automations to fall back to the climate entity's own sensor when the room sensor value has not moved in the configured window.",
    trigger: TRACKED_SENSORS.map((sensor) => ({
      platform: "state",
      entity_id: sensor.entity_id,
      id: sensor.trigger_id,
    })),
    condition: [],
    action: [
      {
        choose: TRACKED_SENSORS.map(trackerBranch),
      },
    ],
    mode: "queued",
  };
}

(async () => {
  const ws = await connectWs();
  const numberResults = {};
  for (const sensor of TRACKED_SENSORS) {
    numberResults[`${sensor.key}_last_seen_value`] = await ensureInputNumber(ws, {
      id: `${sensor.key}_last_seen_value`,
      name: `${sensor.key} last seen value`,
      min: -20,
      max: 50,
      step: 0.1,
      initial: 0,
      unit: "°C",
    });
    await ensureInputDatetime(ws, `${sensor.key}_last_moved`, `${sensor.key} last moved`);
  }
  for (const helper of THRESHOLD_HELPERS) {
    numberResults[helper.id] = await ensureInputNumber(ws, helper);
  }
  ws.close();

  await rest(`/api/config/automation/config/${TRACKER_AUTOMATION_ID}`, "POST", trackerAutomationConfig());
  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/turn_on", "POST", { entity_id: [TRACKER_ENTITY_ID] });

  const states = await rest("/api/states");
  const summary = Object.fromEntries(
    states
      .filter((item) => item.entity_id === TRACKER_ENTITY_ID || item.entity_id.startsWith("input_number.livingr_room_") || item.entity_id.startsWith("input_number.bedroomb_room_"))
      .map((item) => [item.entity_id, item.state]),
  );

  console.log(JSON.stringify({ numberResults, tracker: TRACKER_ENTITY_ID, summary }, null, 2));
})();
