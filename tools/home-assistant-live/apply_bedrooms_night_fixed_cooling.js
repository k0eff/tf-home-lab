// BedroomS night fixed-cooling (2026-07-27).
//
// New input_boolean.bedrooms_night_fixed_cooling (off by default). When on,
// at summer_night_window start (19:30, new time trigger) — if climate_mode
// is summer and the room isn't in away/energy-saving mode — force the AC to
// cool at a hardcoded 24C AC-setpoint (edge-triggered, fires once). 24C is
// intentional, not a mistake: the AC's own internal sensor reads ~0.5C
// warmer than the Xiaomi room sensor (mounted lower), so AC-setpoint 24C ≈
// 23.5C at the Xiaomi sensor / input_number.bedrooms_summer_night_target.
// User-confirmed physical calibration fact, not derived from the existing
// dynamic_setpoint formula.
//
// The existing on/off/fan_only/coil-cooldown cycling (branches "Summer:
// cool...", "Summer: coil cool-down...", "Summer: turn off after coil
// cool-down") is suppressed for the rest of the night by appending
// `and not (summer_night_window and <toggle is on> and not away)` to each —
// away takes precedence over night fixed-cooling, so the existing
// away-relaxed cycling logic still runs untouched while away.
//
// "Night: sleep keeps climate off outside air-clean window" needs no new
// guard: it already carries the 2026-07-24 calendar guard
// (`and not (now().month >= 3 and now().month <= 11)`) and is fully inert
// Mar-Nov regardless of this change.
//
// Fetches the live config fresh (not a static local JSON copy — verified
// 2026-07-27 that bedrooms_comfort_band.json had already drifted stale
// against live, e.g. missing the fan-speed-boost latch action).
//
// Run: node apply_bedrooms_night_fixed_cooling.js

const { connectWs, rest } = require("./ha_ws_util");
const { extractSetupPrefix } = require("./apply_fan_speed_boost");

const AUTOMATION_ID = "1770077000061";
const CLIMATE_ENTITY = "climate.v537_spalniam_2";
const PREFIX = "bedrooms";
const TOGGLE_ID = `${PREFIX}_night_fixed_cooling`;
const AC_SETPOINT_C = 24;
const TRIGGER_ID = "summer_night_fixed_cooling_start";

function assertStructure(cond, msg) {
  if (!cond) throw new Error(`structure mismatch: ${msg}`);
}

async function ensureInputBoolean(ws, id, name, icon) {
  const list = await ws.request({ id: Date.now() % 100000, type: "input_boolean/list" });
  if (!list.success) throw new Error(JSON.stringify(list));
  const existing = list.result.find((item) => item.id === id);
  const payload = { name, icon };
  const res = existing
    ? await ws.request({ id: Date.now() % 100000 + 1, type: "input_boolean/update", input_boolean_id: id, ...payload })
    : await ws.request({ id: Date.now() % 100000 + 1, type: "input_boolean/create", ...payload });
  if (!res.success) throw new Error(`${id}: ${JSON.stringify(res)}`);
  return existing ? "updated" : "created";
}

function suppressionSuffix() {
  return ` and not (summer_night_window and is_state('input_boolean.${TOGGLE_ID}', 'on') and not away)`;
}

function guardExistingBranch(choose, aliasPrefix, exactFinalExpr) {
  const c = choose.find((x) => x.alias && x.alias.startsWith(aliasPrefix));
  assertStructure(!!c, `branch not found: ${aliasPrefix}`);
  const tpl = c.conditions[0].value_template;
  assertStructure(tpl.endsWith(exactFinalExpr), `unexpected tail for: ${aliasPrefix}`);
  const withoutTail = tpl.slice(0, tpl.length - exactFinalExpr.length);
  const newTail = exactFinalExpr.slice(0, -2) + suppressionSuffix() + " }}";
  c.conditions[0].value_template = withoutTail + newTail;
}

function buildNightFixedCoolingAction(setupPrefix) {
  const condTemplate =
    `${setupPrefix}{{ trigger.id == '${TRIGGER_ID}' and climate_mode == 'summer' and ` +
    `is_state('input_boolean.${TOGGLE_ID}', 'on') and not away }}`;
  return {
    alias: "Summer: night fixed-cooling — force continuous cool once at window start",
    conditions: [{ condition: "template", value_template: condTemplate }],
    sequence: [
      { action: "climate.set_hvac_mode", target: { entity_id: CLIMATE_ENTITY }, data: { hvac_mode: "cool" } },
      { action: "climate.set_temperature", target: { entity_id: CLIMATE_ENTITY }, data: { temperature: AC_SETPOINT_C } },
    ],
  };
}

function patchConfig(config) {
  assertStructure(config.id === AUTOMATION_ID, "config id mismatch");

  const setupPrefix = extractSetupPrefix(config, PREFIX);

  assertStructure(Array.isArray(config.triggers), "triggers array missing");
  assertStructure(
    !config.triggers.some((t) => t.id === TRIGGER_ID),
    "trigger already present — already applied?",
  );
  config.triggers.push({ platform: "time", at: "19:30:00", id: TRIGGER_ID });

  assertStructure(config.actions[2] && Array.isArray(config.actions[2].choose), "choose array not at actions[2]");
  const choose = config.actions[2].choose;

  assertStructure(
    !choose.some((c) => c.alias === "Summer: night fixed-cooling — force continuous cool once at window start"),
    "night fixed-cooling branch already present — already applied?",
  );

  guardExistingBranch(
    choose,
    "Summer: cool when room is above target comfort band",
    "{{ not night_air_clean_window and climate_mode == 'summer' and (not night_sleep_window or allow_night_cooling or (now().month >= 3 and now().month <= 11)) and effective is not none and target is not none and effective >= target + active_cooling_start_delta and dynamic_setpoint is not none }}",
  );
  guardExistingBranch(
    choose,
    "Summer: coil cool-down after target is reached",
    "{{ states('climate.v537_spalniam_2') == 'cool' and (climate_mode != 'summer' or (effective is not none and target is not none and effective <= target + learned_overshoot)) }}",
  );
  guardExistingBranch(
    choose,
    "Summer: turn off after coil cool-down",
    "{{ not night_air_clean_window and states('climate.v537_spalniam_2') == 'fan_only' and (state_attr('climate.v537_spalniam_2', 'fan_mode') or '') == (cooling_fan_mode | string) and (as_timestamp(now()) - as_timestamp(states.climate.v537_spalniam_2.last_changed)) >= (coil_cooldown_minutes * 60) }}",
  );

  choose.unshift(buildNightFixedCoolingAction(setupPrefix));

  return config;
}

if (require.main === module) {
  (async () => {
    const ws = await connectWs();
    const helperResult = await ensureInputBoolean(
      ws,
      TOGGLE_ID,
      "BedroomS Night Fixed Cooling",
      "mdi:snowflake-check",
    );

    const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`);
    const patched = patchConfig(config);
    await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
    await rest("/api/services/automation/reload", "POST", {});
    // Posting new config via this API resets the automation to disabled —
    // re-enable it (same quirk apply_fan_speed_boost.js works around).
    await rest("/api/services/automation/turn_on", "POST", {
      entity_id: "automation.test_aircon_bedrooms_room_sensor_comfort_band",
    });

    ws.close();
    console.log(JSON.stringify({ helper: helperResult, automation: "patched" }, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { patchConfig, guardExistingBranch, buildNightFixedCoolingAction, TOGGLE_ID, TRIGGER_ID, AC_SETPOINT_C };
