const { connectWs } = require("./ha_ws_util");

const ids = {
  input_number: [
    "livingr_summer_night_target",
    "livingr_winter_night_target",
    "livingr_override_duration",
    "livingr_manual_target_temperature",
    "bedroomb_override_duration",
    "bedroomb_manual_target_temperature",
  ],
  input_boolean: [
    "livingr_manual_override",
    "bedroomb_manual_override",
  ],
  input_select: [
    "livingr_manual_hvac_mode",
    "livingr_manual_fan_mode",
    "livingr_manual_swing_mode",
    "bedroomb_manual_hvac_mode",
    "bedroomb_manual_fan_mode",
    "bedroomb_manual_swing_mode",
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
