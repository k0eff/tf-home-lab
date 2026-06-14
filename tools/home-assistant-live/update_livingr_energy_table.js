const http = require("http");
const crypto = require("crypto");

const base = (process.env.HA_BASE || "").replace(/\/$/, "");
const token = process.env.HA_TOKEN;

if (!base || !token) {
  throw new Error("HA_BASE and HA_TOKEN are required");
}

const markdown = `### LivingR AC electricity - baseline + last 7 days

| Type | Date | Start | End | Usage |
|---|---|---:|---:|---:|
| Pinned | 07 Jun | 653.0 kWh | 653.9 kWh | 0.9 kWh |
| Pinned | 08 Jun | 654.0 kWh | 654.9 kWh | 0.9 kWh |
| Last 7d | 07 Jun | 653.0 kWh | 653.9 kWh | 0.9 kWh |
| Last 7d | 08 Jun | 654.0 kWh | 654.9 kWh | 0.9 kWh |
| Last 7d | 09 Jun | 655.0 kWh | 655.9 kWh | 0.9 kWh |
| Last 7d | 10 Jun | 656.0 kWh | 656.8 kWh | 0.8 kWh |
| Last 7d | 11 Jun | 656.9 kWh | 657.5 kWh | 0.6 kWh |
| Last 7d | 12 Jun | 657.6 kWh | 658.1 kWh | 0.5 kWh |
| Last 7d | 13 Jun | 658.2 kWh | 658.6 kWh | 0.4 kWh |
| **Last 7d total** |  |  |  | **5.0 kWh** |

Pinned rows are fixed comparison baselines. Last 7d rows are generated from \`sensor.hol_energy_2\` history.`;

function rest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const req = http.request(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${res.statusCode}: ${body}`));
          return;
        }
        resolve(body ? JSON.parse(body) : null);
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function encodeFrame(payload) {
  const data = Buffer.from(JSON.stringify(payload));
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x81;
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 1) masked[i] = data[i] ^ mask[i % 4];
  return Buffer.concat([header, mask, masked]);
}

function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let len = second & 0x7f;
    let cursor = offset + 2;
    if (len === 126) {
      if (cursor + 2 > buffer.length) break;
      len = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (len === 127) {
      if (cursor + 8 > buffer.length) break;
      len = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }
    let mask;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      mask = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }
    if (cursor + len > buffer.length) break;
    let payload = buffer.subarray(cursor, cursor + len);
    if (masked) {
      const unmasked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) unmasked[i] = payload[i] ^ mask[i % 4];
      payload = unmasked;
    }
    frames.push({ opcode, text: payload.toString("utf8") });
    offset = cursor + len;
  }
  return { frames, rest: buffer.subarray(offset) };
}

function connectWs() {
  return new Promise((resolve, reject) => {
    const url = new URL("/api/websocket", base.replace(/^http/, "ws"));
    const key = crypto.randomBytes(16).toString("base64");
    const socket = require(url.protocol === "wss:" ? "tls" : "net").connect({
      host: url.hostname,
      port: Number(url.port || (url.protocol === "wss:" ? 443 : 80)),
      servername: url.hostname,
    });
    let handshake = "";
    let dataBuffer = Buffer.alloc(0);
    let opened = false;
    const waiters = [];

    function handleMessage(message) {
      const json = JSON.parse(message);
      if (json.type === "auth_required") {
        send({ type: "auth", access_token: token });
        return;
      }
      if (json.type === "auth_ok") {
        opened = true;
        resolve({ send, request, close: () => socket.end() });
        return;
      }
      const idx = waiters.findIndex((w) => w.id === json.id);
      if (idx !== -1) {
        const [waiter] = waiters.splice(idx, 1);
        waiter.resolve(json);
      }
    }

    function send(payload) {
      socket.write(encodeFrame(payload));
    }

    function request(payload) {
      return new Promise((resolveReq, rejectReq) => {
        waiters.push({ id: payload.id, resolve: resolveReq, reject: rejectReq });
        send(payload);
      });
    }

    socket.on("connect", () => {
      socket.write([
        `GET ${url.pathname} HTTP/1.1`,
        `Host: ${url.host}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        "",
      ].join("\r\n"));
    });

    socket.on("data", (chunk) => {
      if (!opened && !handshake.includes("\r\n\r\n")) {
        handshake += chunk.toString("binary");
        const split = handshake.indexOf("\r\n\r\n");
        if (split === -1) return;
        const restBytes = Buffer.from(handshake.slice(split + 4), "binary");
        dataBuffer = Buffer.concat([dataBuffer, restBytes]);
      } else {
        dataBuffer = Buffer.concat([dataBuffer, chunk]);
      }
      const decoded = decodeFrames(dataBuffer);
      dataBuffer = decoded.rest;
      for (const frame of decoded.frames) {
        if (frame.opcode === 1) handleMessage(frame.text);
      }
    });

    socket.on("error", reject);
  });
}

function findCards(cards, predicate) {
  const results = [];
  for (const card of cards || []) {
    if (predicate(card)) results.push(card);
    if (card.cards) results.push(...findCards(card.cards, predicate));
  }
  return results;
}

(async () => {
  const ws = await connectWs();
  let id = 1;
  const response = await ws.request({ id: id += 1, type: "lovelace/config", url_path: "my-dash" });
  if (!response.success) throw new Error(JSON.stringify(response));
  const config = response.result;
  const view = config.views.find((candidate) =>
    candidate.path === "livingr-tuning" || candidate.title === "LivingR Tune"
  );
  if (!view) throw new Error("LivingR Tune view not found");

  const markdownCards = findCards(view.cards, (card) =>
    card.type === "markdown" &&
    (card.title === "LivingR AC electricity - last 7 days" ||
      String(card.content || "").includes("LivingR AC electricity"))
  );
  const card = markdownCards[0];
  if (card) {
    card.title = "LivingR AC electricity - baseline + last 7 days";
    card.content = markdown;
  } else {
    view.cards.push({
      type: "markdown",
      title: "LivingR AC electricity - baseline + last 7 days",
      content: markdown,
    });
  }

  const save = await ws.request({
    id: id += 1,
    type: "lovelace/config/save",
    url_path: "my-dash",
    config,
  });
  if (!save.success) throw new Error(JSON.stringify(save));

  const verify = await ws.request({ id: id += 1, type: "lovelace/config", url_path: "my-dash" });
  ws.close();
  if (!verify.success) throw new Error(JSON.stringify(verify));
  const verifyView = verify.result.views.find((candidate) =>
    candidate.path === "livingr-tuning" || candidate.title === "LivingR Tune"
  );
  const verifyCard = findCards(verifyView.cards, (candidate) =>
    candidate.type === "markdown" &&
    String(candidate.content || "").includes("Pinned | 07 Jun")
  )[0];
  console.log(JSON.stringify({
    updated: true,
    title: verifyCard && verifyCard.title,
    pinnedRows: (verifyCard.content.match(/\| Pinned \|/g) || []).length,
    last7dRows: (verifyCard.content.match(/\| Last 7d \|/g) || []).length,
    totalLine: verifyCard.content.includes("**5.0 kWh**"),
  }, null, 2));
})();
