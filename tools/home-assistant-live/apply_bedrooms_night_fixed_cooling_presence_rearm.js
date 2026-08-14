// BedroomS night fixed-cooling presence fix (2026-08-14 incident, follow-up #3).
//
// Incident: at 19:30 the summer_night_fixed_cooling_start trigger fired and the
// branch did nothing, because both person entities still read 'not_home' while
// the room was in fact occupied (binary_sensor.motion04spalniam had been active
// continuously since 18:50). away was therefore true and the branch's "not away"
// gate rejected it. Presence caught up at 19:34:06, but the branch is trigger-id
// gated, so nothing re-armed it and the whole night's fixed cooling was lost -
// the AC had to be switched on by hand at 19:35:46.
//
// Worse, once away went false the three ordinary summer branches were ALSO
// blocked, since each carries "not (summer_night_window and toggle on and not
// away)" to defer to fixed cooling. With fixed cooling already past its one
// shot, nothing at all governed the unit: a dead zone for the rest of the night.
//
// Two independent fixes, either of which would have prevented the incident:
//
//   A. Re-arm on arrival. New trigger on the person entities leaving 'not_home',
//      added to the branch's allowed trigger.id list. Presence catching up late
//      now fires the branch instead of being ignored. Same shape as follow-up #2
//      (apply_bedrooms_night_fixed_cooling_toggle_trigger.js), which fixed the
//      equivalent edge-trigger gap for the toggle.
//
//   B. Motion outranks presence. away now additionally requires motion_quiet_30m
//      (already defined in every template, and already required by the
//      away_by_no_motion path). A stale/lagging phone tracker can no longer
//      declare the house away while a motion sensor is actively reporting.
//
// Run: node apply_bedrooms_night_fixed_cooling_presence_rearm.js

const { rest } = require("./ha_ws_util");

const AUTOMATION_ID = "1770077000061";
const AUTOMATION_ENTITY = "automation.test_aircon_bedrooms_room_sensor_comfort_band";
const PRESENCE_TRIGGER_ID = "night_fixed_cooling_presence_home";
const BRANCH_ALIAS = "Summer: night fixed-cooling — force continuous cool once at window start";

const PERSONS = ["person.krasimir_koev", "person.ema_yosifova"];

// Trigger on leaving 'not_home' rather than entering a literal home state: the
// live person entities read "Home" (zone friendly name), which is not a stable
// contract. The branch's own "not away" gate decides whether arrival counts.
const PRESENCE_TRIGGER = {
  platform: "state",
  entity_id: PERSONS,
  from: "not_home",
  id: PRESENCE_TRIGGER_ID,
};

const OLD_IDS = "trigger.id in ['summer_night_fixed_cooling_start', 'night_fixed_cooling_toggle_on']";
const NEW_IDS = `trigger.id in ['summer_night_fixed_cooling_start', 'night_fixed_cooling_toggle_on', '${PRESENCE_TRIGGER_ID}']`;

// away and away_now share one predicate; motion_quiet_30m is defined earlier in
// every template than either of them, so appending it needs no reordering.
const AWAY_SUFFIX = " and motion_quiet_30m";
const AWAY_DEFS = [
  {
    label: "away",
    from: "{% set away = allow_away_saving and (away_by_presence or away_by_no_motion) %}",
    to: `{% set away = allow_away_saving and (away_by_presence or away_by_no_motion)${AWAY_SUFFIX} %}`,
    expect: 31,
  },
  {
    label: "away_now",
    from: "{% set away_now = allow_away_saving and (away_by_presence or away_by_no_motion) %}",
    to: `{% set away_now = allow_away_saving and (away_by_presence or away_by_no_motion)${AWAY_SUFFIX} %}`,
    expect: 1,
  },
];

function assertStructure(cond, msg) {
  if (!cond) throw new Error(`structure mismatch: ${msg}`);
}

function patchConfig(config) {
  assertStructure(config.id === AUTOMATION_ID, "config id mismatch");

  // A. presence re-arm trigger
  const triggers = config.triggers;
  assertStructure(Array.isArray(triggers), "trigger array not found");
  assertStructure(
    !triggers.some((t) => t.id === PRESENCE_TRIGGER_ID),
    "presence trigger already present — already patched?",
  );
  triggers.push({ ...PRESENCE_TRIGGER });

  const choose = config.actions[2].choose;
  assertStructure(Array.isArray(choose), "outer choose not found at actions[2]");
  const branch = choose.find((c) => c.alias === BRANCH_ALIAS);
  assertStructure(!!branch, "night fixed-cooling branch not found");
  const cond = branch.conditions[0];
  assertStructure(cond.value_template.includes(OLD_IDS), "expected trigger.id list not found — already patched?");
  cond.value_template = cond.value_template.replace(OLD_IDS, NEW_IDS);

  // B. motion outranks presence, across every template in the automation
  let json = JSON.stringify(config);
  for (const def of AWAY_DEFS) {
    const fromJson = JSON.stringify(def.from).slice(1, -1);
    const toJson = JSON.stringify(def.to).slice(1, -1);
    const found = json.split(fromJson).length - 1;
    assertStructure(
      found === def.expect,
      `${def.label}: expected ${def.expect} occurrences, found ${found}`,
    );
    json = json.split(fromJson).join(toJson);
  }

  return JSON.parse(json);
}

if (require.main === module) {
  (async () => {
    const config = await rest(`/api/config/automation/config/${AUTOMATION_ID}`);
    const patched = patchConfig(config);
    await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "POST", patched);
    await rest("/api/services/automation/reload", "POST", {});
    await rest("/api/services/automation/turn_on", "POST", { entity_id: AUTOMATION_ENTITY });

    console.log(JSON.stringify({
      automation: "patched",
      presence_trigger: PRESENCE_TRIGGER_ID,
      away_defs_patched: AWAY_DEFS.map((d) => `${d.label}x${d.expect}`).join(", "),
    }, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { patchConfig, PRESENCE_TRIGGER, OLD_IDS, NEW_IDS, AWAY_DEFS };
