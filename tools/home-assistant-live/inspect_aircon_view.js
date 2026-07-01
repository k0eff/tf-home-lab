const { connectWs } = require("./ha_ws_util");

(async () => {
  const ws = await connectWs();
  const res = await ws.request({ id: 1, type: "lovelace/config", url_path: "my-dash" });
  if (!res.success) throw new Error(JSON.stringify(res));
  const view = res.result.views.find((v) => v.path === "aircon");
  ws.close();
  if (!view) { console.log("NO aircon view found"); return; }
  // Print card index, type, title/entity/content snippet
  const summary = (view.cards || []).map((card, i) => ({
    i,
    type: card.type,
    title: card.title || null,
    entity: card.entity || null,
    entities: card.entities ? card.entities.map((e) => (typeof e === "string" ? e : e.entity)) : null,
    contentSnippet: card.content ? card.content.slice(0, 120) : null,
    stackTypes: card.cards ? card.cards.map((c) => c.type + ":" + (c.entity || c.title || "")) : null,
  }));
  console.log(JSON.stringify(summary, null, 2));
})();
