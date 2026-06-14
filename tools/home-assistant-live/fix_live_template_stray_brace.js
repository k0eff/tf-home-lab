const { rest } = require("./ha_ws_util");

function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = clean(v);
    return out;
  }
  if (typeof value !== "string") return value;
  return value
    .replaceAll("\n}\n{{", "\n{{")
    .replaceAll("\n}\n{%", "\n{%")
    .replaceAll("effective > target + cooling_start_delta", "effective >= target + cooling_start_delta")
    .replaceAll("effective < target - winter_start_delta", "effective <= target - winter_start_delta")
    .replaceAll("effective > target + active_cooling_start_delta", "effective >= target + active_cooling_start_delta")
    .replaceAll("effective < target - active_winter_start_delta", "effective <= target - active_winter_start_delta");
}

(async () => {
  const ids = ["1770077000010", "1770077000021"];
  const result = {};
  for (const id of ids) {
    const config = await rest(`/api/config/automation/config/${id}`);
    const before = JSON.stringify(config);
    const patched = clean(config);
    const after = JSON.stringify(patched);
    await rest(`/api/config/automation/config/${id}`, "POST", patched);
    result[id] = {
      removedStrayBrace: before.includes("\\n}\\n{{") && !after.includes("\\n}\\n{{"),
      hasInclusiveCooling: after.includes("effective >= target + active_cooling_start_delta") || after.includes("effective >= target + cooling_start_delta"),
    };
  }
  await rest("/api/services/automation/reload", "POST", {});
  console.log(JSON.stringify(result, null, 2));
})();
