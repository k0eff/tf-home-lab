const { connectWs, rest } = require("./ha_ws_util");

const viewPaths = new Set(["living", "bedb"]);

function collectEntityIds(value, found = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectEntityIds(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "entity" && typeof child === "string") found.add(child);
      if (key === "entities" && Array.isArray(child)) {
        for (const item of child) {
          if (typeof item === "string") found.add(item);
          else collectEntityIds(item, found);
        }
      } else {
        collectEntityIds(child, found);
      }
    }
  }
  return found;
}

(async () => {
  const ws = await connectWs();
  const dashRes = await ws.request({ id: 1, type: "lovelace/config", url_path: "my-dash" });
  if (!dashRes.success) throw new Error(JSON.stringify(dashRes));
  const states = await rest("/api/states");
  const stateIds = new Set(states.map((item) => item.entity_id));

  const result = {};
  for (const view of dashRes.result.views.filter((item) => viewPaths.has(item.path))) {
    const entityIds = [...collectEntityIds(view.cards || [])].sort();
    result[view.path] = {
      totalEntities: entityIds.length,
      missing: entityIds.filter((entityId) => !stateIds.has(entityId)),
    };
  }

  ws.close();
  console.log(JSON.stringify(result, null, 2));
})();
