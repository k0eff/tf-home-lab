const http = require("http");

const base = (process.env.HA_BASE || "").replace(/\/$/, "");
const token = process.env.HA_TOKEN;

function tpl(template) {
  return new Promise((resolve, reject) => {
    const url = new URL("/api/template", base);
    const body = JSON.stringify({ template });
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

(async () => {
  const onCases = [
    ["1.5 (summer overshoot >= threshold)", "1.5"],
    ["-1.5 (winter undershoot <= -threshold)", "-1.5"],
    ["1.0 (exactly at threshold)", "1.0"],
    ["0.9 (just below threshold)", "0.9"],
  ];
  for (const [desc, expr] of onCases) {
    const t = `{% set error = ${expr} %}\n{% set fan_boost_threshold = states('input_number.livingr_fan_boost_threshold') | float(1.0) %}\n{{ error is not none and (error | abs) >= fan_boost_threshold }}`;
    console.log("ON-cond", desc, "->", await tpl(t));
  }

  const releaseCases = [
    ["0.6 (above thr-margin=0.5, should NOT release)", "0.6"],
    ["0.4 (below thr-margin, should release)", "0.4"],
    ["-0.4 (below thr-margin, should release)", "-0.4"],
  ];
  for (const [desc, expr] of releaseCases) {
    const t = `{% set error = ${expr} %}\n{% set fan_boost_threshold = states('input_number.livingr_fan_boost_threshold') | float(1.0) %}\n{% set fan_boost_release_margin = states('input_number.livingr_fan_boost_release_margin') | float(0.5) %}\n{{ error is not none and (error | abs) < (fan_boost_threshold - fan_boost_release_margin) }}`;
    console.log("RELEASE-cond", desc, "->", await tpl(t));
  }

  const coolingFanCases = [
    ["latch off, no return-boost -> normal cooling speed", false, false],
    ["latch on -> boosted speed", true, false],
    ["return_boost_active on -> boosted speed", false, true],
  ];
  for (const [desc, latch, returnBoost] of coolingFanCases) {
    const t = `{% set return_boost_active = ${returnBoost ? "true" : "false"} %}\n{% set fan_boost_latch_on = ${latch ? "true" : "false"} %}\n{{ (states('input_number.livingr_return_boost_fan_mode') | int(5)) if (return_boost_active or fan_boost_latch_on) else (states('input_number.livingr_cooling_fan_mode') | int(2)) }}`;
    console.log("cooling_fan_mode", desc, "->", await tpl(t));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
