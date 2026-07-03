const { connectWs, rest } = require("./ha_ws_util");

// xiaomi_miot's cloud session can break ("MiCloudException: get device udid
// error", code -704220009) or the physical Aqara/Lumi gateway itself can go
// offline; both look identical from HA (room sensors freeze on a cached
// value). This automation watches the same *_last_moved timestamps the
// fluctuation tracker (setup_room_sensor_staleness_guard.js) already
// maintains and, if none of the tracked room sensors have genuinely moved in
// XIAOMI_MIOT_ENTRY's configured stale window, reloads the xiaomi_miot config
// entry to force a fresh cloud session. A cooldown helper prevents reload
// looping when the cause is a real hardware/network outage that a session
// reload cannot fix.
const XIAOMI_MIOT_ENTRY_ID = "9122367f13a71956c9cd948ada6e2632";

const LAST_MOVED_HELPERS = [
  "input_datetime.livingr_room_last_moved",
  "input_datetime.bedroomb_room_primary_last_moved",
  "input_datetime.bedroomb_room_secondary_last_moved",
];

const THRESHOLD_HELPERS = [
  { id: "xiaomi_miot_self_heal_stale_hours", name: "Xiaomi MIoT Self-Heal Stale Hours", min: 1, max: 24, step: 0.5, initial: 3 },
  { id: "xiaomi_miot_self_heal_cooldown_hours", name: "Xiaomi MIoT Self-Heal Cooldown Hours", min: 1, max: 24, step: 0.5, initial: 6 },
];

const LAST_ATTEMPT_HELPER = "xiaomi_miot_self_heal_last_attempt";
const AUTOMATION_ID = "1770077000100";
const AUTOMATION_ENTITY_ID = "automation.test_aircon_xiaomi_miot_self_heal_reload";

async function ensureInputNumber(ws, { id, name, min, max, step, initial }) {
  const list = await ws.request({ id: Date.now() % 100000, type: "input_number/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === id);
  const payload = { name, min, max, step, mode: "box" };
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
  if (existing) return "exists";
  const res = await ws.request({ id: Date.now() % 100000 + 4, type: "input_datetime/create", name, has_date: true, has_time: true });
  if (!res.success) throw new Error(JSON.stringify(res));
  return "created";
}

function selfHealAutomationConfig() {
  const staleCheck = `[${LAST_MOVED_HELPERS.map((id) => `(as_timestamp(now()) - as_timestamp(states('${id}'))) / 3600`).join(", ")}] | min >= states('input_number.xiaomi_miot_self_heal_stale_hours') | float`;
  const cooldownCheck = `(as_timestamp(now()) - as_timestamp(states('input_datetime.${LAST_ATTEMPT_HELPER}'))) / 3600 >= states('input_number.xiaomi_miot_self_heal_cooldown_hours') | float`;
  return {
    alias: "[TEST] AirCon - xiaomi_miot self-heal reload",
    description:
      "If none of the tracked room sensors (LivingR, BedroomB primary/secondary) have genuinely moved within input_number.xiaomi_miot_self_heal_stale_hours, reloads the xiaomi_miot config entry to force a fresh cloud session. Gated by input_number.xiaomi_miot_self_heal_cooldown_hours so a real gateway/network outage does not cause reload looping. Posts a persistent_notification either way so a recurring failure (which a session reload cannot fix, e.g. the physical gateway itself being offline) is visible.",
    trigger: [{ platform: "time_pattern", minutes: "/30", id: "periodic_check" }],
    condition: [
      { condition: "template", value_template: `{{ ${staleCheck} }}` },
      { condition: "template", value_template: `{{ ${cooldownCheck} }}` },
    ],
    action: [
      { service: "input_datetime.set_datetime", data: { entity_id: `input_datetime.${LAST_ATTEMPT_HELPER}`, timestamp: "{{ as_timestamp(now()) }}" } },
      { service: "homeassistant.reload_config_entry", data: { entry_id: XIAOMI_MIOT_ENTRY_ID } },
      {
        service: "persistent_notification.create",
        data: {
          notification_id: "xiaomi_miot_self_heal",
          title: "Xiaomi cloud self-heal reload",
          message:
            "Room sensors (LivingR/BedroomB) had not genuinely moved in over {{ states('input_number.xiaomi_miot_self_heal_stale_hours') }}h, so the xiaomi_miot integration was reloaded. If this keeps recurring, a session reload will not help - check whether the physical Aqara/Lumi gateway shows offline in the Mi Home app.",
        },
      },
    ],
    mode: "single",
  };
}

(async () => {
  const ws = await connectWs();
  const numberResults = {};
  for (const helper of THRESHOLD_HELPERS) {
    numberResults[helper.id] = await ensureInputNumber(ws, helper);
  }
  const lastAttemptResult = await ensureInputDatetime(ws, LAST_ATTEMPT_HELPER, "Xiaomi MIoT Self-Heal Last Attempt");
  ws.close();

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", selfHealAutomationConfig());
  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/turn_on", "POST", { entity_id: [AUTOMATION_ENTITY_ID] });

  const states = await rest("/api/states");
  const summary = Object.fromEntries(
    states
      .filter((item) => item.entity_id === AUTOMATION_ENTITY_ID || item.entity_id.startsWith("input_number.xiaomi_miot_self_heal_") || item.entity_id === `input_datetime.${LAST_ATTEMPT_HELPER}`)
      .map((item) => [item.entity_id, item.state]),
  );

  console.log(JSON.stringify({ numberResults, lastAttemptResult, automation: AUTOMATION_ENTITY_ID, summary }, null, 2));
})();
