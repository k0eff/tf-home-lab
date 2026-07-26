/**
 * apply_fan_speed_boost.js
 *
 * Adds a fan-speed boost to the LivingR/BedroomB/BedroomS comfort-band
 * automations: when |error| (effective - target) crosses a configurable
 * per-room threshold (default 1.0C) in either direction, fan speed is
 * forced to the room's return_boost_fan_mode value, same as the existing
 * away-return boost -- both triggers share one speed and are combined
 * with a plain OR (see .scratch/aircon-comfort-fan-boost/issues/01).
 *
 * New helpers per room:
 *   - input_number.<prefix>_fan_boost_threshold (default 1.0)
 *   - input_number.<prefix>_fan_boost_release_margin (default 0.5)
 *   - input_boolean.<prefix>_fan_boost_active (restart-safe latch)
 *
 * Patches per room automation:
 *   - extends the existing `cooling_fan_mode` template var to also trigger
 *     off the new latch (in addition to the existing return_boost_active)
 *   - converts the 4 hardcoded fan_mode literals (night air-clean=5,
 *     daytime no-motion=5, daytime motion-restore fan_only default=3,
 *     winter heat=3) into boost-aware templates
 *   - adds a new "Track fan-speed boost latch" action (mirrors the
 *     existing "Track away transition" action) that turns the latch on
 *     when |error| >= threshold and off when |error| < threshold - margin
 */

const { connectWs, rest } = require("./ha_ws_util");

const ROOMS = [
  { prefix: "livingr", automationId: "1770077000010", climate: "climate.hol_2", label: "LivingR" },
  { prefix: "bedroomb", automationId: "1770077000021", climate: "climate.v357_spalniag_2", label: "BedroomB" },
  { prefix: "bedrooms", automationId: "1770077000061", climate: "climate.v537_spalniam_2", label: "BedroomS" },
];

let seq = 500;
const nextId = () => ++seq;

async function ensureInputNumber(ws, id, name, min, max, step, initial, unit) {
  const list = await ws.request({ id: nextId(), type: "input_number/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === id);
  const payload = { name, min, max, step, mode: "box", ...(unit ? { unit_of_measurement: unit } : {}) };
  const res = existing
    ? await ws.request({ id: nextId(), type: "input_number/update", input_number_id: id, ...payload })
    : await ws.request({ id: nextId(), type: "input_number/create", ...payload });
  if (!res.success) throw new Error(`${id}: ${JSON.stringify(res)}`);
  if (!existing) await rest("/api/services/input_number/set_value", "POST", { entity_id: `input_number.${id}`, value: initial });
  return existing ? "updated" : "created";
}

async function ensureInputBoolean(ws, id, name, icon) {
  const list = await ws.request({ id: nextId(), type: "input_boolean/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === id);
  const payload = { name, icon };
  const res = existing
    ? await ws.request({ id: nextId(), type: "input_boolean/update", input_boolean_id: id, ...payload })
    : await ws.request({ id: nextId(), type: "input_boolean/create", ...payload });
  if (!res.success) throw new Error(`${id}: ${JSON.stringify(res)}`);
  return existing ? "updated" : "created";
}

function boostAwareLiteral(prefix, fallbackLiteral) {
  return `{% set fan_boost_latch_on = is_state('input_boolean.${prefix}_fan_boost_active', 'on') %}
{% set away_ended_at = states('input_datetime.${prefix}_away_ended_at') %}
{% set return_boost_minutes = states('input_number.${prefix}_return_boost_minutes') | float(20) %}
{% set return_boost_active = away_ended_at not in ['unknown', 'unavailable', 'none'] and (as_timestamp(now()) - as_timestamp(away_ended_at, 0)) < (return_boost_minutes * 60) %}
{% set boost_triggered = fan_boost_latch_on or return_boost_active %}
{{ (states('input_number.${prefix}_return_boost_fan_mode') | int(5)) if boost_triggered else ${fallbackLiteral} }}`;
}

function extendCoolingFanMode(text, prefix) {
  const find = `{% set cooling_fan_mode = (states('input_number.${prefix}_return_boost_fan_mode') | int(5)) if return_boost_active else (states('input_number.${prefix}_cooling_fan_mode') | int(2)) %}`;
  if (!text.includes(find)) return text;
  const replace = `{% set fan_boost_latch_on = is_state('input_boolean.${prefix}_fan_boost_active', 'on') %}\n{% set cooling_fan_mode = (states('input_number.${prefix}_return_boost_fan_mode') | int(5)) if (return_boost_active or fan_boost_latch_on) else (states('input_number.${prefix}_cooling_fan_mode') | int(2)) %}`;
  return text.split(find).join(replace);
}

function deepPatchCoolingFanMode(node, prefix) {
  if (typeof node === "string") return extendCoolingFanMode(node, prefix);
  if (Array.isArray(node)) return node.map((n) => deepPatchCoolingFanMode(n, prefix));
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = deepPatchCoolingFanMode(node[k], prefix);
    return out;
  }
  return node;
}

function assertStructure(cond, prefix, msg) {
  if (!cond) throw new Error(`${prefix}: structure mismatch: ${msg}`);
}

function patchLiteralFanModes(config, prefix) {
  const choose = config.actions[1].choose;

  assertStructure(choose[0].alias && choose[0].alias.startsWith("Night: air cleaning"), prefix, "choose[0] alias");
  assertStructure(choose[0].sequence[2] && choose[0].sequence[2].data && choose[0].sequence[2].data.fan_mode === "5", prefix, "choose[0].sequence[2].data.fan_mode");
  choose[0].sequence[2].data.fan_mode = boostAwareLiteral(prefix, "5");

  assertStructure(choose[2].alias && choose[2].alias.startsWith("Daytime no motion"), prefix, "choose[2] alias");
  assertStructure(choose[2].sequence[0] && choose[2].sequence[0].data && choose[2].sequence[0].data.fan_mode === "5", prefix, "choose[2].sequence[0].data.fan_mode");
  choose[2].sequence[0].data.fan_mode = boostAwareLiteral(prefix, "5");

  assertStructure(choose[3].alias && choose[3].alias.startsWith("Daytime motion"), prefix, "choose[3] alias");
  const nested = choose[3].sequence[0];
  assertStructure(nested && nested.default && nested.default[0] && nested.default[0].data && nested.default[0].data.fan_mode === "3", prefix, "choose[3].sequence[0].default[0].data.fan_mode");
  nested.default[0].data.fan_mode = boostAwareLiteral(prefix, "3");

  const winterIdx = choose.findIndex((c) => c.alias && c.alias.startsWith("Winter: heat"));
  assertStructure(winterIdx >= 0, prefix, "winter heat branch not found");
  const winterSeq = choose[winterIdx].sequence;
  const winterFanIdx = winterSeq.findIndex((s) => s.data && s.data.fan_mode === "3");
  assertStructure(winterFanIdx >= 0, prefix, "winter heat branch fan_mode literal 3 not found");
  winterSeq[winterFanIdx].data.fan_mode = boostAwareLiteral(prefix, "3");

  return config;
}

function buildLatchAction(prefix, setupPrefix) {
  const onTemplate = `${setupPrefix}{% set fan_boost_threshold = states('input_number.${prefix}_fan_boost_threshold') | float(1.0) %}\n{{ error is not none and (error | abs) >= fan_boost_threshold }}`;
  const offTemplate = `${setupPrefix}{% set fan_boost_threshold = states('input_number.${prefix}_fan_boost_threshold') | float(1.0) %}\n{% set fan_boost_release_margin = states('input_number.${prefix}_fan_boost_release_margin') | float(0.5) %}\n{{ is_state('input_boolean.${prefix}_fan_boost_active', 'on') and error is not none and (error | abs) < (fan_boost_threshold - fan_boost_release_margin) }}`;
  return {
    alias: "Track fan-speed boost latch (error threshold trigger)",
    if: [{ condition: "template", value_template: onTemplate }],
    then: [{ target: { entity_id: `input_boolean.${prefix}_fan_boost_active` }, action: "input_boolean.turn_on" }],
    else: [
      {
        if: [{ condition: "template", value_template: offTemplate }],
        then: [{ target: { entity_id: `input_boolean.${prefix}_fan_boost_active` }, action: "input_boolean.turn_off" }],
      },
    ],
  };
}

function extractSetupPrefix(config, prefix) {
  const masterCond = config.conditions.find((c) => c.value_template && c.value_template.includes("manual_override_active"));
  assertStructure(!!masterCond, prefix, "master condition not found");
  const tailMarker = "{{ not manual_override_active }}";
  assertStructure(masterCond.value_template.endsWith(tailMarker), prefix, "master condition tail mismatch");
  return masterCond.value_template.slice(0, masterCond.value_template.length - tailMarker.length);
}

function patchRoomConfig(config, prefix) {
  const setupPrefix = extractSetupPrefix(config, prefix);

  let patched = deepPatchCoolingFanMode(config, prefix);
  patched = patchLiteralFanModes(patched, prefix);

  const awayIdx = patched.actions.findIndex((a) => a.alias && a.alias.startsWith("Track away transition"));
  assertStructure(awayIdx >= 0, prefix, "away-tracking action not found");
  patched.actions.splice(awayIdx + 1, 0, buildLatchAction(prefix, setupPrefix));

  patched.description = `${patched.description} FAN-SPEED BOOST: when |error| (effective - target) crosses input_number.${prefix}_fan_boost_threshold (default 1.0C) in either direction, input_boolean.${prefix}_fan_boost_active latches on (a new "Track fan-speed boost latch" action, mirroring the return-boost tracker) and releases only once |error| drops below (threshold - input_number.${prefix}_fan_boost_release_margin, default 0.5C). This latch is OR-combined with the existing return_boost_active condition inside cooling_fan_mode, so both triggers share the same input_number.${prefix}_return_boost_fan_mode speed and override fan_mode regardless of hvac/fan_only phase (night air-clean, daytime no-motion raise, daytime motion-restore, winter heat all became boost-aware). Symmetric for summer overshoot and winter undershoot.`;

  return patched;
}

module.exports = { ROOMS, ensureInputNumber, ensureInputBoolean, patchRoomConfig, extractSetupPrefix, boostAwareLiteral, extendCoolingFanMode };

if (require.main === module) {
  (async () => {
    const ws = await connectWs();
    const changes = { helpers: {}, automations: {} };

    for (const room of ROOMS) {
      changes.helpers[`${room.prefix}_fan_boost_threshold`] = await ensureInputNumber(
        ws,
        `${room.prefix}_fan_boost_threshold`,
        `${room.label} Fan Boost Threshold`,
        0.5,
        3,
        0.1,
        1.0,
        "°C",
      );
      changes.helpers[`${room.prefix}_fan_boost_release_margin`] = await ensureInputNumber(
        ws,
        `${room.prefix}_fan_boost_release_margin`,
        `${room.label} Fan Boost Release Margin`,
        0.1,
        1.5,
        0.1,
        0.5,
        "°C",
      );
      changes.helpers[`${room.prefix}_fan_boost_active`] = await ensureInputBoolean(
        ws,
        `${room.prefix}_fan_boost_active`,
        `${room.label} Fan Boost Active`,
        "mdi:fan-alert",
      );
    }

    for (const room of ROOMS) {
      const config = await rest(`/api/config/automation/config/${room.automationId}`);
      const patched = patchRoomConfig(config, room.prefix);
      await rest(`/api/config/automation/config/${room.automationId}`, "POST", patched);
      changes.automations[room.label] = "patched";
    }

    await rest("/api/services/automation/reload", "POST", {});
    await rest("/api/services/automation/turn_on", "POST", {
      entity_id: ROOMS.map((r) => `automation.test_aircon_${r.prefix}_room_sensor_comfort_band`),
    });

    ws.close();
    console.log(JSON.stringify(changes, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
