/**
 * verify_fan_boost.js
 *
 * Verification criteria for the Lossnay fan boost feature:
 *   C1. All 4 helpers exist in HA
 *   C2. Boost automation exists and is enabled
 *   C3. Aircon dashboard has both boost cards after "Lossnay Ventilation"
 *   C4. Pressing boost_30m button sets fan to "4" and active to "on"
 *   C5. Cancelling boost restores fan to "2" and active to "off"
 */

const { connectWs, rest } = require("./ha_ws_util");

const VENTI_FAN_SPEED = "select.venti_fan_speed";
const BOOST_AUTOMATION_ID = "1770077000052";
const BOOST_AUTOMATION_ALIAS = "[TEST] Lossnay - fan boost";
const ACTIVE = "input_boolean.lossnay_fan_boost_active";
const UNTIL = "input_datetime.lossnay_fan_boost_until";
const BTN_30 = "input_button.lossnay_fan_boost_30m";
const BTN_60 = "input_button.lossnay_fan_boost_60m";

const BOOST_LEVEL = "4";
const NORMAL_LEVEL = "2";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let wsSeq = 100;
const nextId = () => ++wsSeq;

async function getState(ws, entityId) {
  const res = await ws.request({ id: nextId(), type: "get_states" });
  if (!res.success) throw new Error("get_states failed");
  const found = res.result.find((e) => e.entity_id === entityId);
  return found ? found.state : null;
}

async function callService(ws, domain, service, entityId, extraData = {}) {
  const res = await ws.request({
    id: nextId(),
    type: "call_service",
    domain,
    service,
    target: { entity_id: entityId },
    service_data: { entity_id: entityId, ...extraData },
  });
  if (!res.success) throw new Error(`${domain}.${service} on ${entityId} failed: ${JSON.stringify(res)}`);
}

(async () => {
  const ws = await connectWs();
  const results = {};

  // --- C1: Helpers exist ---
  {
    const boolList = await ws.request({ id: nextId(), type: "input_boolean/list" });
    const dtList = await ws.request({ id: nextId(), type: "input_datetime/list" });
    const btnList = await ws.request({ id: nextId(), type: "input_button/list" });

    const boolIds = boolList.result.map((x) => x.id);
    const dtIds = dtList.result.map((x) => x.id);
    const btnIds = btnList.result.map((x) => x.id);

    const slug = (e) => e.replace(/^[^.]+\./, "");
    const helpers = {
      [ACTIVE]: boolIds.includes(slug(ACTIVE)),
      [UNTIL]: dtIds.includes(slug(UNTIL)),
      [BTN_30]: btnIds.includes(slug(BTN_30)),
      [BTN_60]: btnIds.includes(slug(BTN_60)),
    };
    results.C1_helpers = { pass: Object.values(helpers).every(Boolean), detail: helpers };
  }

  // --- C2: Automation exists and enabled ---
  {
    const cfg = await rest(`/api/config/automation/config/${BOOST_AUTOMATION_ID}`);
    const aliasMatch = cfg && cfg.alias === BOOST_AUTOMATION_ALIAS;

    // Check enabled via states
    const states = await ws.request({ id: nextId(), type: "get_states" });
    const autoEntity = states.result.find(
      (e) => e.entity_id.startsWith("automation.") && (e.attributes.id === BOOST_AUTOMATION_ID || String(e.attributes.alias || "").includes("fan boost"))
    );
    const enabled = autoEntity ? autoEntity.state === "on" : null;

    results.C2_automation = {
      pass: aliasMatch && enabled !== false,
      detail: { aliasMatch, enabled, entity: autoEntity ? autoEntity.entity_id : null },
    };
  }

  // --- C3: Dashboard cards present in correct position ---
  {
    const dash = await ws.request({ id: nextId(), type: "lovelace/config", url_path: "my-dash" });
    const aircon = dash.result.views.find((v) => v.path === "aircon");
    const topCards = aircon ? aircon.cards || [] : [];

    // Lossnay + boost cards are grouped in a vertical-stack so masonry keeps them together
    const stack = topCards.find(
      (c) => c.type === "vertical-stack" && (c.cards || []).some((x) => x.type === "entities" && x.title === "Lossnay Ventilation")
    );
    const cards = stack ? stack.cards : topCards;
    const lossnayIdx = cards.findIndex((c) => c.type === "entities" && c.title === "Lossnay Ventilation");
    const statusCard = cards[lossnayIdx + 1];
    const controlCard = cards[lossnayIdx + 2];

    const statusOk = statusCard && statusCard.type === "markdown" && String(statusCard.content || "").includes("fan_boost");
    const controlOk = controlCard && controlCard.type === "horizontal-stack" && (controlCard.cards || []).some((c) => String(c.entity || "").includes("fan_boost"));

    results.C3_dashboard = {
      pass: statusOk && controlOk,
      detail: {
        lossnayCardIdx: lossnayIdx,
        statusCardType: statusCard ? statusCard.type : null,
        controlCardType: controlCard ? controlCard.type : null,
        statusOk,
        controlOk,
      },
    };
  }

  // --- C4: Press boost_30m → fan = "4", active = "on" ---
  {
    // Record baseline fan speed
    const baseline = await getState(ws, VENTI_FAN_SPEED);

    // Press the 30m boost button
    await callService(ws, "input_button", "press", BTN_30);
    await sleep(6000); // Lossnay hardware round-trip observed ~2s, allow margin

    const fanAfterBoost = await getState(ws, VENTI_FAN_SPEED);
    const activeAfterBoost = await getState(ws, ACTIVE);

    results.C4_boost_activate = {
      pass: fanAfterBoost === BOOST_LEVEL && activeAfterBoost === "on",
      detail: { baseline, fanAfterBoost, activeAfterBoost },
    };
  }

  // --- C5: Cancel boost → fan = NORMAL_LEVEL, active = "off" ---
  {
    await callService(ws, "input_boolean", "turn_off", ACTIVE);
    await sleep(6000);

    const fanAfterCancel = await getState(ws, VENTI_FAN_SPEED);
    const activeAfterCancel = await getState(ws, ACTIVE);

    results.C5_boost_cancel = {
      pass: fanAfterCancel === NORMAL_LEVEL && activeAfterCancel === "off",
      detail: { fanAfterCancel, activeAfterCancel },
    };
  }

  ws.close();

  const allPass = Object.values(results).every((r) => r.pass);
  console.log(JSON.stringify({ allPass, criteria: results }, null, 2));
  process.exitCode = allPass ? 0 : 1;
})();
