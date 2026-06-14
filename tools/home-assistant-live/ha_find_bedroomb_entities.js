const http = require("http");

const base = (process.env.HA_BASE || "").replace(/\/$/, "");
const token = process.env.HA_TOKEN;

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const req = http.request(url, {
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${res.statusCode}: ${body}`));
          return;
        }
        resolve(JSON.parse(body));
      });
    });
    req.on("error", reject);
    req.end();
  });
}

(async () => {
  const states = await get("/api/states");
  const hay = (state) => [
    state.entity_id,
    state.attributes?.friendly_name,
    state.attributes?.device_class,
    state.attributes?.unit_of_measurement,
  ].filter(Boolean).join(" ").toLowerCase();

  const terms = [
    "bedroomb",
    "bedroom b",
    "spalniag",
    "spalnia g",
    "v357",
    "miaomiaoce",
    "temperature humidity sensor",
    "motion03",
    "motion04",
    "energy",
    "power",
  ];

  const matches = states
    .filter((state) => terms.some((term) => hay(state).includes(term)))
    .map((state) => ({
      entity_id: state.entity_id,
      state: state.state,
      friendly_name: state.attributes?.friendly_name,
      unit: state.attributes?.unit_of_measurement,
      device_class: state.attributes?.device_class,
      current_temperature: state.attributes?.current_temperature,
      temperature: state.attributes?.temperature,
      fan_mode: state.attributes?.fan_mode,
      hvac_modes: state.attributes?.hvac_modes,
    }))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  console.log(JSON.stringify(matches, null, 2));
})();
