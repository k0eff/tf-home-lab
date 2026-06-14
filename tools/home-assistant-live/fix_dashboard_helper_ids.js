const { connectWs, rest } = require("./ha_ws_util");

const replacements = new Map([
  ["input_boolean.livingr_manual_override_active", "input_boolean.livingr_manual_override"],
  ["input_number.livingr_manual_override_duration_minutes", "input_number.livingr_override_duration"],
  ["input_number.livingr_manual_override_target_temperature", "input_number.livingr_manual_target_temperature"],
  ["input_select.livingr_manual_override_hvac_mode", "input_select.livingr_manual_hvac_mode"],
  ["input_select.livingr_manual_override_fan_mode", "input_select.livingr_manual_fan_mode"],
  ["input_select.livingr_manual_override_swing_mode", "input_select.livingr_manual_swing_mode"],
  ["input_number.livingr_night_summer_target", "input_number.livingr_summer_night_target"],
  ["input_number.livingr_night_winter_target", "input_number.livingr_winter_night_target"],
  ["input_boolean.bedroomb_manual_override_active", "input_boolean.bedroomb_manual_override"],
  ["input_number.bedroomb_manual_override_duration_minutes", "input_number.bedroomb_override_duration"],
  ["input_number.bedroomb_manual_override_target_temperature", "input_number.bedroomb_manual_target_temperature"],
  ["input_select.bedroomb_manual_override_hvac_mode", "input_select.bedroomb_manual_hvac_mode"],
  ["input_select.bedroomb_manual_override_fan_mode", "input_select.bedroomb_manual_fan_mode"],
  ["input_select.bedroomb_manual_override_swing_mode", "input_select.bedroomb_manual_swing_mode"],
]);

function replaceInString(text) {
  let result = text;
  for (const [from, to] of replacements.entries()) {
    result = result.split(from).join(to);
  }
  return result;
}

function patchValue(value) {
  if (Array.isArray(value)) return value.map(patchValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, patchValue(child)]));
  }
  if (typeof value === "string") return replaceInString(value);
  return value;
}

(async () => {
  const ws = await connectWs();
  const automationIds = ["1770077000010", "1770077000021", "1770077000041", "1770077000042"];
  for (const id of automationIds) {
    const cfg = await rest(`/api/config/automation/config/${id}`);
    await rest(`/api/config/automation/config/${id}`, "POST", patchValue(cfg));
  }
  await rest("/api/services/automation/reload", "POST", {});

  let requestId = 1;
  const dashRes = await ws.request({ id: ++requestId, type: "lovelace/config", url_path: "my-dash" });
  if (!dashRes.success) throw new Error(JSON.stringify(dashRes));
  const dash = patchValue(dashRes.result);
  const saveRes = await ws.request({ id: ++requestId, type: "lovelace/config/save", url_path: "my-dash", config: dash });
  if (!saveRes.success) throw new Error(JSON.stringify(saveRes));
  ws.close();

  console.log(JSON.stringify({ updated: true }, null, 2));
})();
