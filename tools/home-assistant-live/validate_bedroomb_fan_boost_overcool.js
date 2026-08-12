// Validation for eval 014 - BedroomB fan-boost overcool + cooldown-shutdown
// deadlock. Renders the OLD and NEW predicates side by side against explicit
// literal inputs (not live state) so the behavioural difference stays
// reproducible after the room temperature has moved on, then checks the live
// automation for structural containment.

const http = require("http");
const { rest } = require("./ha_ws_util");

// /api/template answers in plain text, which ha_ws_util's rest() would try to
// JSON.parse. Keep a raw variant just for template renders.
function restText(path, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, (process.env.HA_BASE || "").replace(/\/$/, ""));
    const body = JSON.stringify(payload);
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HA_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          res.statusCode >= 200 && res.statusCode < 300
            ? resolve(data)
            : reject(new Error(`${res.statusCode}: ${data}`)),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

const AUTOMATION_ID = "1770077000021";
const AUTOMATION_ENTITY = "automation.test_aircon_bedroomb_room_sensor_comfort_band";
const SIBLINGS = {
  livingr: "1770077000010",
  bedrooms: "1770077000061",
};

const THRESHOLD = 1.0;
const EFFECTIVE_MARGIN = 0.5;

const OLD_ON = "{{ error is not none and (error | abs) >= fan_boost_threshold }}";
const NEW_ON =
  "{% set boost_error = none if error is none else (error if climate_mode == 'summer' else (0 - error)) %}\n" +
  "{{ boost_error is not none and boost_error >= fan_boost_threshold }}";

const OLD_RELEASE =
  "{{ error is not none and (error | abs) < (fan_boost_threshold - fan_boost_effective_margin) }}";
const NEW_RELEASE =
  "{% set boost_error = none if error is none else (error if climate_mode == 'summer' else (0 - error)) %}\n" +
  "{{ boost_error is none or boost_error < (fan_boost_threshold - fan_boost_effective_margin) }}";

const OLD_EFFECTIVE =
  "{{ ([candidate, ac_temp] | max) if climate_mode == 'summer' else ([candidate, ac_temp] | min) }}";
const NEW_EFFECTIVE = "{{ candidate }}";

function preamble(vars) {
  return Object.entries(vars)
    .map(([k, v]) => `{% set ${k} = ${typeof v === "string" ? `'${v}'` : v} %}`)
    .join("\n");
}

async function render(template, vars) {
  const body = `${preamble(vars)}\n${template}`;
  const out = await restText("/api/template", { template: body });
  return String(out).trim();
}

const results = [];
function check(id, description, actual, expected) {
  const pass = String(actual) === String(expected);
  results.push({ id, pass, description, actual: String(actual), expected: String(expected) });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}  ${description}\n       got=${actual} want=${expected}`);
}

async function main() {
  const boostVars = (error, climate_mode) => ({
    error,
    climate_mode,
    fan_boost_threshold: THRESHOLD,
    fan_boost_effective_margin: EFFECTIVE_MARGIN,
  });

  // C2 - summer overcool must not latch the boost (the reported symptom)
  check(
    "C2a",
    "OLD ON at error=-1.5 summer (overcooled) latched the boost - the defect",
    await render(OLD_ON, boostVars(-1.5, "summer")),
    "True",
  );
  check(
    "C2b",
    "NEW ON at error=-1.5 summer does NOT latch",
    await render(NEW_ON, boostVars(-1.5, "summer")),
    "False",
  );
  check(
    "C2c",
    "NEW ON at error=+1.5 summer (genuine overshoot) still latches",
    await render(NEW_ON, boostVars(1.5, "summer")),
    "True",
  );

  // C3/C4 - eval 006's winter symmetry intent must survive, mirrored correctly
  check(
    "C3",
    "NEW ON at error=-1.5 winter (undershoot, needs heat) still latches",
    await render(NEW_ON, boostVars(-1.5, "winter")),
    "True",
  );
  check(
    "C4a",
    "OLD ON at error=+1.5 winter (overheated) latched - the winter mirror of the defect",
    await render(OLD_ON, boostVars(1.5, "winter")),
    "True",
  );
  check(
    "C4b",
    "NEW ON at error=+1.5 winter does NOT latch",
    await render(NEW_ON, boostVars(1.5, "winter")),
    "False",
  );

  // C5 - the exact stuck-latch value measured during the incident
  check(
    "C5a",
    "OLD RELEASE at the incident value error=-0.7 summer refused to release",
    await render(OLD_RELEASE, boostVars(-0.7, "summer")),
    "False",
  );
  check(
    "C5b",
    "NEW RELEASE at error=-0.7 summer releases",
    await render(NEW_RELEASE, boostVars(-0.7, "summer")),
    "True",
  );
  check(
    "C5c",
    "NEW RELEASE at error=+0.7 summer still holds (hysteresis band intact)",
    await render(NEW_RELEASE, boostVars(0.7, "summer")),
    "False",
  );

  // C7/C8 - disagreement resolver, at the incident's real readings
  const resolverVars = { candidate: 23.7, ac_temp: 25.5, climate_mode: "summer" };
  check(
    "C8",
    "OLD resolver controlled to the ceiling-level AC reading",
    await render(OLD_EFFECTIVE, resolverVars),
    "25.5",
  );
  check(
    "C7",
    "NEW resolver follows the occupied-level room sensor",
    await render(NEW_EFFECTIVE, resolverVars),
    "23.7",
  );
  check(
    "C8b",
    "OLD resolver yielded a positive error (would command cooling into a cold room)",
    await render("{{ (([candidate, ac_temp] | max) - 24.4) | round(1) }}", resolverVars),
    "1.1",
  );
  check(
    "C7b",
    "NEW resolver yields a negative error (correctly reads as already cold)",
    await render("{{ (candidate - 24.4) | round(1) }}", resolverVars),
    "-0.7",
  );

  // C9/C10 - structural containment on the live config
  const cfg = await rest(`/api/config/automation/config/${AUTOMATION_ID}`, "GET");
  const raw = JSON.stringify(cfg);
  const count = (n) => raw.split(n).length - 1;

  check("C9a", "no '(error | abs)' left in BedroomB", count("(error | abs)"), 0);
  check("C9b", "no 'conflict_worst_case' left in BedroomB", count("conflict_worst_case"), 0);
  check("C9c", "season-aware boost_error present in both latch legs", count("set boost_error"), 2);
  check("C9d", "disagreement still observable via renamed source label", count("conflict_trust_room_sensor"), 30);
  check(
    "C10",
    "cooldown-shutdown fan-equality deadlock clause removed",
    count("== (cooling_fan_mode | string) and "),
    0,
  );

  for (const [name, id] of Object.entries(SIBLINGS)) {
    const sib = JSON.stringify(await rest(`/api/config/automation/config/${id}`, "GET"));
    const sibCount = (n) => sib.split(n).length - 1;
    check(
      `C9e-${name}`,
      `${name} deliberately untouched - still carries the abs() defect`,
      sibCount("(error | abs)") > 0,
      "true",
    );
    check(
      `C9f-${name}`,
      `${name} deliberately untouched - still carries conflict_worst_case`,
      sibCount("conflict_worst_case") > 0,
      "true",
    );
  }

  // C11 - automation healthy after reload
  const states = await rest("/api/states", "GET");
  const auto = states.find((s) => s.entity_id === AUTOMATION_ENTITY);
  check("C11", "comfort-band automation enabled after reload", auto && auto.state, "on");

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
