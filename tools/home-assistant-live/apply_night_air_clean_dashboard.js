// Eval 038 - put the night air-clean toggle on each room's Tune view.
//
// The owner asked for this as a dashboard checkbox ("да стане отметка в
// дашборда"), so the helper is not done until it is visible and clickable.
// LivingR and BedroomS already have a "Night" card; BedroomB has none, so one
// is created mirroring their shape. BedroomB has no allow_night_cooling helper
// at all - a separate, still-open parity gap - so its card omits that row.
//
//   node apply_night_air_clean_dashboard.js         dry run
//   node apply_night_air_clean_dashboard.js --yes   apply live + rewrite the snapshot
//
// Env: HA_BASE, HA_TOKEN.

const fs = require("fs");
const path = require("path");
const { connectWs } = require("./ha_ws_util");

const SNAPSHOT = path.join(__dirname, "my_dash_lovelace_config.json");
const URL_PATH = "my-dash";

const ROOMS = [
  { view: "living", prefix: "livingr"  },
  { view: "bedb",   prefix: "bedroomb" },
  { view: "beds",   prefix: "bedrooms" },
];

function nightCardFor(prefix, existingEntities) {
  const rows = existingEntities && existingEntities.length
    ? existingEntities.slice()
    : [
        `input_number.${prefix}_night_summer_target`,
        `input_number.${prefix}_night_cooling_start_delta`,
        `input_number.${prefix}_night_winter_target`,
        `input_number.${prefix}_night_winter_start_delta`,
      ];
  return { type: "entities", title: "Night", entities: rows };
}

function patchView(view, prefix) {
  const toggle = `input_boolean.${prefix}_allow_night_air_clean`;
  const cards = view.cards || (view.cards = []);
  const night = cards.find((c) => c.type === "entities" && c.title === "Night");

  if (night) {
    const ids = (night.entities || []).map((e) => (typeof e === "string" ? e : e.entity));
    if (ids.includes(toggle)) return { action: "already present", card: "Night" };
    night.entities = night.entities || [];
    night.entities.push(toggle);
    return { action: "appended to existing Night card", card: "Night" };
  }

  // No Night card (BedroomB): build one, and place it where the siblings keep
  // theirs - last - so the three Tune views stay comparable.
  const card = nightCardFor(prefix, null);
  card.entities.push(toggle);
  cards.push(card);
  return { action: "created Night card", card: "Night" };
}

async function main() {
  const write = process.argv.includes("--yes");
  const ws = await connectWs();
  let id = 500;
  try {
    const live = await ws.request({ id: ++id, type: "lovelace/config", url_path: URL_PATH });
    if (!live.success) throw new Error(`lovelace/config failed: ${JSON.stringify(live.error || live)}`);
    const config = live.result;

    let changed = 0;
    for (const r of ROOMS) {
      const view = (config.views || []).find((v) => v.path === r.view);
      if (!view) throw new Error(`view ${r.view} not found`);
      const res = patchView(view, r.prefix);
      console.log(`  ${r.view.padEnd(7)} ${r.prefix.padEnd(9)} ${res.action}`);
      if (res.action !== "already present") changed += 1;
    }

    // Every referenced entity must exist, or the card renders as an error row.
    const missing = [];
    const states = (await ws.request({ id: ++id, type: "get_states" })).result.map((s) => s.entity_id);
    for (const r of ROOMS) {
      const view = config.views.find((v) => v.path === r.view);
      const night = view.cards.find((c) => c.type === "entities" && c.title === "Night");
      for (const e of night.entities) {
        const eid = typeof e === "string" ? e : e.entity;
        if (!states.includes(eid)) missing.push(`${r.view}: ${eid}`);
      }
    }
    if (missing.length) throw new Error(`dashboard would reference entities that do not exist:\n  ${missing.join("\n  ")}`);

    if (!write) { console.log(`\ndry run - ${changed} view(s) would change (pass --yes)`); return; }
    if (!changed) { console.log("\nno change - no-op"); return; }

    const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: URL_PATH, config });
    if (!save.success) throw new Error(`save failed: ${JSON.stringify(save.error || save)}`);

    const after = await ws.request({ id: ++id, type: "lovelace/config", url_path: URL_PATH });
    for (const r of ROOMS) {
      const view = after.result.views.find((v) => v.path === r.view);
      const night = view.cards.find((c) => c.type === "entities" && c.title === "Night");
      const ids = night.entities.map((e) => (typeof e === "string" ? e : e.entity));
      if (!ids.includes(`input_boolean.${r.prefix}_allow_night_air_clean`)) {
        throw new Error(`${r.view}: toggle missing after save`);
      }
    }
    // The snapshot is compact single-line JSON with no trailing newline; writing it
    // any other way turns a four-entity change into a 2,200-line diff.
    fs.writeFileSync(SNAPSHOT, JSON.stringify(after.result));
    console.log("\nsaved live and rewrote the snapshot; all three toggles verified present");
  } finally {
    ws.close();
  }
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
