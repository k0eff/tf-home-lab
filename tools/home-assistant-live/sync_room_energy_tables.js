const fs = require("fs");
const path = require("path");
const { connectWs, rest } = require("./ha_ws_util");

const timeZone = "Europe/Sofia";

const rooms = [
  {
    key: "livingr",
    title: "LivingR",
    viewPath: "living",
    energyEntity: "sensor.hol_energy_2",
    outputFile: "livingr_energy_table.md",
    pinnedFile: "livingr_energy_table_pinned.md",
    pinnedRows: [
      { day: "07 Jun", start: 653.0, end: 653.9, usage: 0.9 },
      { day: "08 Jun", start: 654.0, end: 654.9, usage: 0.9 },
    ],
  },
  {
    key: "bedroomb",
    title: "BedroomB",
    viewPath: "bedb",
    energyEntity: "sensor.v357_spalniag_energy_2",
    outputFile: "bedroomb_energy_table.md",
    pinnedFile: null,
    pinnedRows: [],
  },
];

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDay(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatKwh(value) {
  return `${Number(value).toFixed(1)} kWh`;
}

async function fetchDailyRows(entityId) {
  const today = startOfLocalDay(new Date());
  const firstDay = addDays(today, -7);
  const periodStart = addDays(firstDay, -1);
  const pathName = `/api/history/period/${periodStart.toISOString()}?filter_entity_id=${encodeURIComponent(entityId)}&end_time=${encodeURIComponent(today.toISOString())}&minimal_response&no_attributes`;
  const history = ((await rest(pathName))[0] || [])
    .map((entry) => ({
      changedAt: new Date(entry.last_changed),
      state: Number(entry.state),
    }))
    .filter((entry) => Number.isFinite(entry.state))
    .sort((left, right) => left.changedAt - right.changedAt);

  let index = 0;
  let current = history[0]?.state;
  const rows = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const dayStart = addDays(firstDay, dayOffset);
    const dayEnd = addDays(dayStart, 1);

    while (index < history.length && history[index].changedAt < dayStart) {
      current = history[index].state;
      index += 1;
    }

    const start = current;

    while (index < history.length && history[index].changedAt < dayEnd) {
      current = history[index].state;
      index += 1;
    }

    const end = current;
    rows.push({
      day: formatDay(dayStart),
      start,
      end,
      usage: start != null && end != null ? Math.max(0, +(end - start).toFixed(1)) : null,
    });
  }

  return rows;
}

function buildRecentMarkdown(room, rows) {
  const total = rows.reduce((sum, row) => sum + (row.usage || 0), 0);
  return `### ${room.title} AC electricity - last 7 days

| Date | Start | End | Usage |
|---|---:|---:|---:|
${rows.map((row) => `| ${row.day} | ${formatKwh(row.start)} | ${formatKwh(row.end)} | ${formatKwh(row.usage)} |`).join("\n")}
| **Total** |  |  | **${formatKwh(total)}** |

Updated from \`${room.energyEntity}\` history.`;
}

function buildPinnedMarkdown(room, rows) {
  const pinnedDays = new Set(room.pinnedRows.map((row) => row.day));
  const recentRows = rows.filter((row) => !pinnedDays.has(row.day));
  const total = recentRows.reduce((sum, row) => sum + (row.usage || 0), 0);
  return `### ${room.title} AC electricity - baseline + recent days

| Type | Date | Start | End | Usage |
|---|---|---:|---:|---:|
${room.pinnedRows.map((row) => `| Pinned | ${row.day} | ${formatKwh(row.start)} | ${formatKwh(row.end)} | ${formatKwh(row.usage)} |`).join("\n")}
${recentRows.map((row) => `| Recent | ${row.day} | ${formatKwh(row.start)} | ${formatKwh(row.end)} | ${formatKwh(row.usage)} |`).join("\n")}
| **Recent total** |  |  |  | **${formatKwh(total)}** |

Pinned rows are fixed comparison baselines. Recent rows are generated from \`${room.energyEntity}\` history.`;
}

function energyCardTitle(room) {
  return `${room.title} AC electricity`;
}

function findCardIndex(view, predicate) {
  return (view.cards || []).findIndex(predicate);
}

function upsertEnergyCard(view, room, content) {
  view.cards = view.cards || [];
  const card = {
    type: "markdown",
    title: energyCardTitle(room),
    content,
  };

  const existingIndex = findCardIndex(
    view,
    (candidate) =>
      candidate.type === "markdown" &&
      (candidate.title === energyCardTitle(room) ||
        String(candidate.content || "").includes(`${room.title} AC electricity`)),
  );

  if (existingIndex !== -1) {
    view.cards[existingIndex] = card;
    return existingIndex;
  }

  const electricityIndex = findCardIndex(
    view,
    (candidate) => candidate.type === "entities" && candidate.title === "Electricity",
  );
  const temperatureHistoryIndex = findCardIndex(
    view,
    (candidate) => candidate.type === "history-graph" && candidate.title === "Temperature history",
  );

  if (electricityIndex !== -1) {
    view.cards.splice(electricityIndex + 1, 0, card);
    return electricityIndex + 1;
  }
  if (temperatureHistoryIndex !== -1) {
    view.cards.splice(temperatureHistoryIndex, 0, card);
    return temperatureHistoryIndex;
  }

  view.cards.push(card);
  return view.cards.length - 1;
}

async function patchDashboard(contentsByRoom) {
  const ws = await connectWs();
  let id = 1;
  const lovelace = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!lovelace.success) throw new Error(JSON.stringify(lovelace));
  const config = lovelace.result;
  const updated = [];

  for (const room of rooms) {
    const view = (config.views || []).find((candidate) => candidate.path === room.viewPath);
    if (!view) throw new Error(`Missing view ${room.viewPath}`);
    const cardIndex = upsertEnergyCard(view, room, contentsByRoom[room.key]);
    updated.push({ view: room.viewPath, cardIndex });
  }

  const save = await ws.request({
    id: ++id,
    type: "lovelace/config/save",
    url_path: "my-dash",
    config,
  });
  ws.close();
  if (!save.success) throw new Error(JSON.stringify(save));
  return updated;
}

(async () => {
  const result = {};
  const contentsByRoom = {};

  for (const room of rooms) {
    const rows = await fetchDailyRows(room.energyEntity);
    const markdown = buildRecentMarkdown(room, rows);
    const recentPath = path.join(__dirname, room.outputFile);
    fs.writeFileSync(recentPath, `${markdown}\n`, "utf8");

    let dashboardContent = markdown;
    let pinnedPath = null;
    if (room.pinnedFile) {
      const pinnedMarkdown = buildPinnedMarkdown(room, rows);
      pinnedPath = path.join(__dirname, room.pinnedFile);
      fs.writeFileSync(pinnedPath, `${pinnedMarkdown}\n`, "utf8");
      dashboardContent = pinnedMarkdown;
    }

    contentsByRoom[room.key] = dashboardContent;
    result[room.key] = {
      rows,
      recentFile: recentPath,
      pinnedFile: pinnedPath,
    };
  }

  result.dashboard = await patchDashboard(contentsByRoom);
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
