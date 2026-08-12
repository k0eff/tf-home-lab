// Incident 2026-08-06, second defect found while verifying
// fix_bedroomb_fan_boost_overcool.js: after the fan-boost latch released, the
// unit still sat in `fan_only` at fan speed 5 with every one of the 9 comfort
// branches evaluating False, so nothing was left to either lower the fan or
// shut the unit down. It blew at max indefinitely.
//
// The "Summer: turn off after coil cool-down" branch gates on the unit's
// current fan speed matching the configured cooling speed:
//
//   not night_air_clean_window
//   and state == 'fan_only'
//   and (fan_mode or '') == (cooling_fan_mode | string)      <-- this clause
//   and elapsed_since_last_changed >= coil_cooldown_minutes * 60
//
// Measured live at the time of the incident: night_air_clean_window False,
// state fan_only, elapsed 13.4min >= 11min - all True. The fan-equality clause
// was the sole False: fan_mode was "5", cooling_fan_mode was 2.
//
// Nothing in the automation can close that gap, which makes the state
// unreachable rather than merely unlikely:
//   - "Daytime no motion: raise fan" is guarded by fan_mode not in ['2','5'],
//     so once it has raised the fan to 5 it refuses to touch it again;
//   - "Daytime motion: restore fan 3" requires motion, and the no-motion case
//     is exactly when the fan got raised to 5 in the first place.
// So fan 5 is a terminal value: the shutdown branch waits for a 2 that can
// never arrive, and the unit runs at max until someone intervenes by hand.
//
// The route into that state is the fan-boost latch: cooling ran at boost speed
// 5, coil cool-down inherited fan 5, then the latch released and
// cooling_fan_mode dropped back to 2 - stranding the comparison permanently.
// Fixing the latch (see fix_bedroomb_fan_boost_overcool.js) removes the common
// route in, but the deadlock itself is independent and would still be reachable
// via the away-circulation branch, so it is fixed here on its own terms.
//
// Fix: drop the fan-equality clause. The remaining three clauses already
// characterise the situation completely - we are not in the night air-clean
// window, the unit has been sitting in fan_only, and it has been there longer
// than the coil cool-down. What speed the fan happens to be turning at while
// it idles is not evidence about whether it should still be on. The night
// air-cleaning feature, which is the one case that legitimately wants fan_only
// at max held open, stays protected by the untouched night_air_clean_window
// guard.
//
// Behavioural change worth stating plainly: daytime no-motion circulation in
// fan_only now ends after coil_cooldown_minutes instead of continuing
// indefinitely.
//
// BedroomB only, same scope containment as the companion fix. Applied via REST
// against the live automation config; main.tf mirrored separately.

const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000021";
const AUTOMATION_ENTITY = "automation.test_aircon_bedroomb_room_sensor_comfort_band";

const FAN_EQUALITY_CLAUSE =
  "(state_attr('climate.v357_spalniag_2', 'fan_mode') or '') == (cooling_fan_mode | string) and ";

function transformStrings(node, fn) {
  if (typeof node === "string") return fn(node);
  if (Array.isArray(node)) return node.map((n) => transformStrings(n, fn));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = transformStrings(v, fn);
    return out;
  }
  return node;
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

async function snapshot(label) {
  const states = await rest("/api/states", "GET");
  const by = Object.fromEntries(states.map((s) => [s.entity_id, s]));
  const climate = by["climate.v357_spalniag_2"];
  const snap = {
    label,
    hvac_mode: climate?.state,
    fan_mode: climate?.attributes?.fan_mode,
    primary_room: by["sensor.miaomiaoce_t2_5249_temperature"]?.state,
    target: by["input_number.bedroomb_target_temperature"]?.state,
    fan_boost_active: by["input_boolean.bedroomb_fan_boost_active"]?.state,
  };
  console.log(JSON.stringify(snap, null, 2));
  return snap;
}

async function main() {
  console.log("=== BEFORE ===");
  const before = await snapshot("before");

  const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
  const beforeRaw = JSON.stringify(config);

  const found = countOccurrences(beforeRaw, FAN_EQUALITY_CLAUSE);
  console.log(`\nfan-equality clause occurrences: ${found}`);
  if (found !== 1) {
    throw new Error(`refusing to write: expected exactly 1 occurrence, found ${found}`);
  }

  const patched = transformStrings(config, (s) => s.split(FAN_EQUALITY_CLAUSE).join(""));
  const afterRaw = JSON.stringify(patched);

  if (countOccurrences(afterRaw, FAN_EQUALITY_CLAUSE) !== 0) {
    throw new Error("refusing to write: clause still present after patch");
  }
  if (afterRaw === beforeRaw) throw new Error("refusing to write: config unchanged");
  if (beforeRaw.length - afterRaw.length !== FAN_EQUALITY_CLAUSE.length) {
    throw new Error("refusing to write: unexpected size delta, patch was not surgical");
  }

  await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
  await rest("/api/services/automation/reload", "POST", {});
  await rest("/api/services/automation/trigger", "POST", { entity_id: AUTOMATION_ENTITY });

  await new Promise((resolve) => setTimeout(resolve, 6000));

  console.log("\n=== AFTER ===");
  const after = await snapshot("after");

  console.log("\n=== DELTA ===");
  console.log(
    JSON.stringify(
      {
        hvac_mode: `${before.hvac_mode} -> ${after.hvac_mode}`,
        fan_mode: `${before.fan_mode} -> ${after.fan_mode}`,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
