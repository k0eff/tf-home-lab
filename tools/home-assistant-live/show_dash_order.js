const { connectWs } = require("./ha_ws_util");

const wanted = new Set(["living", "bedb"]);

function label(card, index) {
  if (card.title) return `${index}. ${card.title}`;
  if (card.type === "markdown" && typeof card.content === "string") {
    const line = card.content.split("\n").find((item) => item.trim());
    return `${index}. markdown: ${line?.trim().slice(0, 60) || "(empty)"}`;
  }
  if (card.type === "entities" && Array.isArray(card.entities) && card.entities[0]) {
    const first = typeof card.entities[0] === "string" ? card.entities[0] : card.entities[0].entity || "(unknown)";
    return `${index}. entities: ${first}`;
  }
  return `${index}. ${card.type || "unknown"}`;
}

(async () => {
  const ws = await connectWs();
  const res = await ws.request({ id: 1, type: "lovelace/config", url_path: "my-dash" });
  if (!res.success) throw new Error(JSON.stringify(res));
  const out = {};
  for (const view of res.result.views.filter((item) => wanted.has(item.path))) {
    out[view.path] = (view.cards || []).map((card, index) => label(card, index + 1));
  }
  ws.close();
  console.log(JSON.stringify(out, null, 2));
})();
