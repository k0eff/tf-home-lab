const { rest } = require("./ha_ws_util");

// Room-name token fixes only. Applied as substring replacement on whatever
// alias is already live, so any existing prefix ([OLD]/[V2]/etc, not part of
// this map) survives untouched instead of being silently dropped.
const TOKEN_FIXES = [
  ["Bedroom B", "BedroomB"],
  ["Living R", "LivingR"],
  ["Hol - hidden light", "LivingR - hidden light"],
  ["Light-Hol-turn-off", "Light-LivingR-turn-off"],
];

const IDS = [
  "1685485075161",
  "1685485186799",
  "1735256615192",
  "1735256531604",
  "1691441711392",
  "168548507516199",
  "168548518679999",
  "173525661519299",
  "173525653160499",
  "169144171139299",
];

function fixAlias(alias) {
  let out = alias;
  for (const [from, to] of TOKEN_FIXES) out = out.split(from).join(to);
  return out;
}

(async () => {
  const results = [];
  for (const id of IDS) {
    const cfg = await rest(`/api/config/automation/config/${id}`);
    const before = cfg.alias;
    const after = fixAlias(before);
    if (after !== before) {
      cfg.alias = after;
      await rest(`/api/config/automation/config/${id}`, "POST", cfg);
    }
    results.push({ id, before, after });
  }
  await rest("/api/services/automation/reload", "POST", {});
  console.log(JSON.stringify({ updated: results }, null, 2));
})();
