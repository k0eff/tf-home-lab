const { connectWs } = require("./ha_ws_util");

function keyFor(card) {
  if (card.title) return `title:${card.title}`;
  if (card.type === "markdown" && typeof card.content === "string") {
    if (card.content.includes("Manual override status")) return "markdown:manual_override_status";
    if (card.content.includes("Active scenario")) return "markdown:active_scenario";
  }
  if (card.type) return `type:${card.type}`;
  return "unknown";
}

(async () => {
  const ws = await connectWs();
  let id = 1;
  const res = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!res.success) throw new Error(JSON.stringify(res));

  const dash = res.result;
  const living = dash.views.find((view) => view.path === "living");
  const bedb = dash.views.find((view) => view.path === "bedb");
  if (!living || !bedb) throw new Error("Missing living or bedb view");

  const desiredKeys = (living.cards || []).map(keyFor);
  const buckets = new Map();
  for (const card of bedb.cards || []) {
    const key = keyFor(card);
    const existing = buckets.get(key) || [];
    existing.push(card);
    buckets.set(key, existing);
  }

  const reordered = [];
  for (const key of desiredKeys) {
    const bucket = buckets.get(key);
    if (bucket && bucket.length) reordered.push(bucket.shift());
  }

  for (const remaining of buckets.values()) {
    for (const card of remaining) reordered.push(card);
  }

  bedb.cards = reordered;
  const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config: dash });
  if (!save.success) throw new Error(JSON.stringify(save));
  ws.close();
  console.log(JSON.stringify({ updated: true, cards: reordered.length }, null, 2));
})();
