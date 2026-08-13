// Shared model for the logic-invariant evals (018-029).
//
// Two sources of truth get loaded here and nowhere else:
//   - the repository:  app/stacks/home-assistant/{main.tf,import.tf,helpers.json}
//   - the live instance: /api/config/automation/config/<id>, /api/states, /api/template
//
// Every check in validate_logic.js is written against this model, so a parsing
// bug shows up once rather than twelve times.

const fs = require("fs");
const path = require("path");
const { rest } = require("./ha_ws_util");

const STACK = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant");
const MAIN_TF = path.join(STACK, "main.tf");
const IMPORT_TF = path.join(STACK, "import.tf");
const HELPERS = path.join(STACK, "helpers.json");

// ---------------------------------------------------------------- HCL strings

// main.tf stores each automation field as ONE physical line holding a quoted
// HCL string. Unescaping must be a single left-to-right pass: a two-pass
// implementation turns the literal backslash-n inside "\\n" into a newline,
// which is exactly the corruption eval 016 was opened for.
function hclUnescape(s) {
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] !== "\\") { out += s[i]; continue; }
    const c = s[i + 1];
    i += 1;
    if (c === "n") out += "\n";
    else if (c === "t") out += "\t";
    else if (c === "r") out += "\r";
    else if (c === '"') out += '"';
    else if (c === "\\") out += "\\";
    else { out += "\\" + c; }   // unknown escape survives verbatim
  }
  return out;
}

function hclEscape(s) {
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return out;
}

// ------------------------------------------------------------- main.tf model

const FIELD_RE = /^\s{2}(\w+)\s*=\s*"(.*)"\s*$/;
const JSONENCODE_RE = /^\s{2}(\w+)\s*=\s*(jsonencode\()/;
const RESOURCE_RE = /^resource\s+"homeassistant_automation"\s+"([^"]+)"\s*\{\s*$/;

// main.tf mixes two serialisations for the same field. Older automations store
// an HCL-escaped JSON string on one physical line; newer ones (every comfort
// band, i.e. all the interesting control logic) use a multi-line
// jsonencode([...]) expression. A parser that only knows the first silently
// reports the second as empty, which would make every check below vacuously
// pass on exactly the automations worth checking.
//
// The jsonencode bodies are NOT parsed here. They are handed to terraform for
// evaluation (see evalWithTerraform) because terraform is the authority on its
// own syntax and a hand-rolled HCL subset parser would be one more thing that
// can be quietly wrong.
function matchParen(text, openIdx) {
  let depth = 0, inStr = false;
  for (let i = openIdx; i < text.length; i += 1) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") { i += 1; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "(") depth += 1;
    else if (c === ")") { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

function parseMainTf(text) {
  const lines = text.split("\n");
  // Byte offset of the start of each line, so a line index maps to a text index.
  const offsets = [];
  let acc = 0;
  for (const l of lines) { offsets.push(acc); acc += l.length + 1; }

  const resources = [];
  let cur = null;
  let skipUntilLine = -1;

  lines.forEach((line, idx) => {
    if (idx < skipUntilLine) return;
    const r = RESOURCE_RE.exec(line);
    if (r) { cur = { name: r[1], line: idx + 1, fields: {}, fieldLines: {}, raw: {}, style: {} }; return; }
    if (!cur) return;
    if (/^\}\s*$/.test(line)) { resources.push(cur); cur = null; return; }

    const je = JSONENCODE_RE.exec(line);
    if (je) {
      const openIdx = offsets[idx] + line.indexOf("jsonencode(") + "jsonencode".length;
      const close = matchParen(text, openIdx);
      if (close !== -1) {
        const expr = text.slice(offsets[idx] + line.indexOf("jsonencode("), close + 1);
        cur.raw[je[1]] = expr;
        cur.style[je[1]] = "jsonencode";
        cur.fieldLines[je[1]] = idx + 1;
        // Skip the lines the expression spans so its inner "key" = value lines
        // are not mistaken for fields of the resource.
        skipUntilLine = text.slice(0, close).split("\n").length;
      }
      return;
    }

    const f = FIELD_RE.exec(line);
    if (f) {
      cur.fields[f[1]] = hclUnescape(f[2]);
      cur.raw[f[1]] = f[2];
      cur.style[f[1]] = "string";
      cur.fieldLines[f[1]] = idx + 1;
    }
  });
  return resources;
}

// Evaluate every jsonencode(...) field by handing it to terraform, then fold
// the results back into resource.fields so downstream checks see one uniform
// shape regardless of which serialisation the resource happens to use.
function evalWithTerraform(resources, workDir) {
  const { execFileSync } = require("child_process");
  const os = require("os");
  const dir = workDir || fs.mkdtempSync(path.join(os.tmpdir(), "tf-logic-"));
  const keys = [];
  let cfg = "";
  resources.forEach((res, ri) => {
    for (const [field, style] of Object.entries(res.style)) {
      if (style !== "jsonencode") continue;
      const key = `r${ri}_${field}`;
      keys.push({ key, name: res.name, field });
      cfg += `output "${key}" {\n  value = ${res.raw[field]}\n}\n\n`;
    }
  });
  if (!keys.length) return { dir, evaluated: 0 };
  fs.writeFileSync(path.join(dir, "main.tf"), cfg);
  // terraform apply echoes every output value, and these outputs are whole
  // automation configs - the default 1 MB stdout buffer is not close to enough.
  const run = (args) => execFileSync("terraform", args, {
    cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 512 * 1024 * 1024,
  });
  run(["init", "-input=false", "-no-color"]);
  run(["apply", "-auto-approve", "-input=false", "-no-color"]);
  const out = JSON.parse(run(["output", "-json", "-no-color"]));
  const byName = new Map(resources.map((r) => [r.name, r]));
  for (const { key, name, field } of keys) {
    if (out[key] === undefined) continue;
    byName.get(name).fields[field] = out[key].value;
  }
  return { dir, evaluated: keys.length };
}

// trigger / condition / action are JSON documents stored inside the HCL string.
function parseJsonField(res, field) {
  const v = res.fields[field];
  if (v === undefined) return { ok: true, value: undefined, absent: true };
  try {
    return { ok: true, value: JSON.parse(v) };
  } catch (e) {
    return { ok: false, error: e.message, value: undefined };
  }
}

const IMPORT_RE = /import\s*\{\s*to\s*=\s*homeassistant_automation\.([A-Za-z0-9_]+)\s*id\s*=\s*"([^"]+)"\s*\}/g;

function parseImportTf(text) {
  const out = [];
  const flat = text.replace(/[\r\n]+/g, " ");
  let m;
  while ((m = IMPORT_RE.exec(flat)) !== null) out.push({ name: m[1], id: m[2] });
  return out;
}

// Evaluating 177 jsonencode expressions costs a terraform init+apply, so the
// result is cached under a key derived from main.tf's own bytes. Any edit to
// main.tf changes the key and the cache misses, which is the only invalidation
// rule that cannot go stale.
function loadRepo({ noCache = false } = {}) {
  const mainText = fs.readFileSync(MAIN_TF, "utf8");
  const resources = parseMainTf(mainText);
  const digest = require("crypto").createHash("sha256").update(mainText).digest("hex").slice(0, 16);
  const cacheFile = path.join(require("os").tmpdir(), `tf-logic-eval-${digest}.json`);
  let cached = null;
  if (!noCache && fs.existsSync(cacheFile)) {
    try { cached = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch (e) { cached = null; }
  }
  if (cached) {
    for (const r of resources) {
      for (const field of Object.keys(r.style)) {
        if (r.style[field] === "jsonencode" && cached[`${r.name}.${field}`] !== undefined) {
          r.fields[field] = cached[`${r.name}.${field}`];
        }
      }
    }
  } else {
    evalWithTerraform(resources);
    const dump = {};
    for (const r of resources) {
      for (const field of Object.keys(r.style)) {
        if (r.style[field] === "jsonencode" && r.fields[field] !== undefined) {
          dump[`${r.name}.${field}`] = r.fields[field];
        }
      }
    }
    fs.writeFileSync(cacheFile, JSON.stringify(dump));
  }
  const imports = parseImportTf(fs.readFileSync(IMPORT_TF, "utf8"));
  const byName = new Map(resources.map((r) => [r.name, r]));
  const idByName = new Map(imports.map((i) => [i.name, i.id]));
  return {
    mainText,
    mainPath: MAIN_TF,
    resources,
    imports,
    byName,
    idByName,
    helpers: JSON.parse(fs.readFileSync(HELPERS, "utf8")),
  };
}

// --------------------------------------------------------------- live model

// Home Assistant accepts and emits two spellings of the same config. Newer
// cores return trigger/condition/action objects with `trigger:` and `action:`
// keys where older ones used `platform:` and `service:`, and pluralise the top
// level keys. Comparison happens after normalisation so that a core upgrade
// does not read as 98 automations of drift.
function normaliseConfig(cfg) {
  if (!cfg) return null;
  const trg = cfg.triggers !== undefined ? cfg.triggers : cfg.trigger;
  const cnd = cfg.conditions !== undefined ? cfg.conditions : cfg.condition;
  const act = cfg.actions !== undefined ? cfg.actions : cfg.action;
  return {
    alias: cfg.alias,
    description: cfg.description === undefined ? "" : cfg.description,
    mode: cfg.mode === undefined ? "single" : cfg.mode,
    trigger: normNode(asArray(trg), "trigger"),
    condition: normNode(asArray(cnd), "condition"),
    action: normNode(asArray(act), "action"),
  };
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Recursively rename the moved keys. `platform` only means "trigger kind"
// inside a trigger node, and `service` only means "call this" inside an action
// node, so the rename is scoped by context rather than applied blindly.
function normNode(node, kind) {
  if (Array.isArray(node)) return node.map((n) => normNode(n, kind));
  if (node === null || typeof node !== "object") return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    let key = k;
    if (kind === "trigger" && k === "platform") key = "trigger";
    if (kind === "action" && k === "service") key = "action";
    let childKind = kind;
    if (k === "trigger" || k === "triggers") childKind = "trigger";
    if (k === "condition" || k === "conditions") childKind = "condition";
    if (k === "action" || k === "actions" || k === "then" || k === "else"
        || k === "sequence" || k === "default") childKind = "action";
    out[key] = normNode(v, childKind);
  }
  return out;
}

// Stable stringify so two structurally equal configs compare equal regardless
// of key insertion order.
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  }
  return JSON.stringify(v === undefined ? null : v);
}

function repoConfig(res) {
  return normaliseConfig({
    alias: res.fields.alias,
    description: res.fields.description,
    mode: res.fields.mode,
    trigger: safeJson(res.fields.trigger),
    condition: safeJson(res.fields.condition),
    action: safeJson(res.fields.action),
  });
}

function safeJson(s) {
  if (s === undefined) return undefined;
  try { return JSON.parse(s); } catch (e) { return undefined; }
}

async function fetchLiveAutomation(id) {
  try {
    return await rest(`/api/config/automation/config/${id}`, "GET");
  } catch (e) {
    return { __error: e.message };
  }
}

async function fetchStates() {
  return rest("/api/states", "GET");
}

// /api/template returns PLAIN TEXT, not JSON, so rest() cannot be used - it
// parses the body and throws on the first non-JSON byte.
function renderTemplate(tpl) {
  const http = require("http");
  const https = require("https");
  const base = (process.env.HA_BASE || "").replace(/\/$/, "");
  const u = new URL(base + "/api/template");
  const lib = u.protocol === "https:" ? https : http;
  const body = JSON.stringify({ template: tpl });
  return new Promise((resolve) => {
    const req = lib.request({
      hostname: u.hostname, port: u.port, path: u.pathname, method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HA_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    req.write(body);
    req.end();
  });
}

// Every entity id mentioned anywhere in a resource's serialised fields.
const ENTITY_RE = /\b(sensor|binary_sensor|climate|input_number|input_boolean|input_select|input_text|input_datetime|switch|light|person|weather|automation|fan|cover|number|select|button|device_tracker|calendar|media_player|vacuum|lock|scene|script|sun|zone)\.[a-z0-9_]+\b/g;

function entitiesIn(text) {
  return [...new Set((text.match(ENTITY_RE) || []))];
}

// Every Jinja template embedded in a resource, with a locator for reporting.
function templatesIn(res) {
  const out = [];
  for (const field of ["trigger", "condition", "action"]) {
    const v = res.fields[field];
    if (!v) continue;
    walkStrings(safeJson(v), (s, pathStr) => {
      if (s.includes("{{") || s.includes("{%")) out.push({ field, path: pathStr, tpl: s });
    });
  }
  return out;
}

function walkStrings(node, fn, pathStr = "") {
  if (typeof node === "string") { fn(node, pathStr); return; }
  if (Array.isArray(node)) { node.forEach((n, i) => walkStrings(n, fn, `${pathStr}[${i}]`)); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walkStrings(v, fn, pathStr ? `${pathStr}.${k}` : k);
  }
}

module.exports = {
  STACK, MAIN_TF, IMPORT_TF, HELPERS,
  hclUnescape, hclEscape,
  parseMainTf, parseImportTf, parseJsonField, loadRepo,
  normaliseConfig, canonical, repoConfig, safeJson,
  fetchLiveAutomation, fetchStates, renderTemplate,
  entitiesIn, templatesIn, walkStrings,
};
