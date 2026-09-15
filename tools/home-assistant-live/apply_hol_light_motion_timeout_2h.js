const { rest } = require("./ha_ws_util");

const IDS = ["1691441711392", "169144171139299"];

function patchTrigger(cfg) {
  const trigger = Array.isArray(cfg.trigger) ? cfg.trigger : [cfg.trigger];
  for (const t of trigger) {
    if (t && t.type === "no_motion") {
      t.for = { hours: 2, minutes: 0, seconds: 0 };
    }
  }
  return cfg;
}

(async () => {
  const results = [];
  for (const id of IDS) {
    const cfg = await rest(`/api/config/automation/config/${id}`);
    const patched = patchTrigger(cfg);
    await rest(`/api/config/automation/config/${id}`, "POST", patched);
    results.push({ id, alias: cfg.alias, for: patched.trigger[0].for });
  }
  await rest("/api/services/automation/reload", "POST", {});
  console.log(JSON.stringify({ updated: results }, null, 2));
})();
