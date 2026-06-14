const { connectWs } = require("./ha_ws_util");

const ids = {
  input_number: [
    "livingr_night_summer_target",
    "livingr_night_winter_target",
    "livingr_manual_override_duration_minutes",
    "livingr_manual_override_target_temperature",
    "bedroomb_manual_override_duration_minutes",
    "bedroomb_manual_override_target_temperature",
  ],
  input_boolean: [
    "livingr_manual_override_active",
    "bedroomb_manual_override_active",
  ],
  input_select: [
    "livingr_manual_override_hvac_mode",
    "livingr_manual_override_fan_mode",
    "livingr_manual_override_swing_mode",
    "bedroomb_manual_override_hvac_mode",
    "bedroomb_manual_override_fan_mode",
    "bedroomb_manual_override_swing_mode",
  ],
  input_datetime: [
    "livingr_manual_override_until",
    "bedroomb_manual_override_until",
  ],
};

(async () => {
  const ws = await connectWs();
  let reqId = 1;
  const result = {};
  for (const [domain, expectedIds] of Object.entries(ids)) {
    const res = await ws.request({ id: ++reqId, type: `${domain}/list` });
    if (!res.success) throw new Error(JSON.stringify(res));
    const existing = new Set(res.result.map((item) => item.id));
    result[domain] = {
      expected: expectedIds,
      present: expectedIds.filter((helperId) => existing.has(helperId)),
      missing: expectedIds.filter((helperId) => !existing.has(helperId)),
    };
  }
  ws.close();
  console.log(JSON.stringify(result, null, 2));
})();
