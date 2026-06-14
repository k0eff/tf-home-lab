const http = require("http");
const net = require("net");
const crypto = require("crypto");

const base = (process.env.HA_BASE || "").replace(/\/$/, "");
const token = process.env.HA_TOKEN;

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
    const socket = net.connect({
      host: url.hostname,
      port: Number(url.port || 80),
    });
    let handshake = "";
    let dataBuffer = Buffer.alloc(0);
    let opened = false;
    const waiters = [];

    function send(payload) {
      socket.write(encodeFrame(payload));
    }

    function request(payload) {
      return new Promise((resolveReq, rejectReq) => {
        waiters.push({ id: payload.id, resolve: resolveReq, reject: rejectReq });
        send(payload);
      });
    }

    function handleMessage(message) {
      const json = JSON.parse(message);
      if (json.type === "auth_required") {
        send({ type: "auth", access_token: token });
        return;
      }
      if (json.type === "auth_ok") {
        opened = true;
        resolve({ request, close: () => socket.end() });
        return;
      }
      const idx = waiters.findIndex((waiter) => waiter.id === json.id);
      if (idx !== -1) {
        const [waiter] = waiters.splice(idx, 1);
        waiter.resolve(json);
      }
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
        dataBuffer = Buffer.concat([dataBuffer, Buffer.from(handshake.slice(split + 4), "binary")]);
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

function rest(path, method = "GET", payload = undefined) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    const req = http.request(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${res.statusCode}: ${data}`));
          return;
        }
        resolve(data ? JSON.parse(data) : null);
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

module.exports = { connectWs, rest };
