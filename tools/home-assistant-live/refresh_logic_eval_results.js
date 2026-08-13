#!/usr/bin/env node
// Runs the logic-invariant suites (validate_logic.js) and writes what they
// actually measured back into evals/018..029.
//
// The point is that no measured number in an eval file is ever typed by hand.
// The eval's prose - description, implementation, incidents - is authored; its
// validation.result, validation.measured and status are transcribed from a real
// run against the live instance and nothing else. If a check starts failing,
// re-running this makes the eval file say so instead of leaving a stale "pass"
// behind, which is the only failure mode a written-down eval really has.
//
// Usage:
//   node tools/home-assistant-live/refresh_logic_eval_results.js          # write
//   node tools/home-assistant-live/refresh_logic_eval_results.js --check  # verify only
//
// Requires HA_BASE and HA_TOKEN in the environment, same as every other tool here.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const EVALS_DIR = path.join(ROOT, "evals");
const VALIDATOR = path.join(__dirname, "validate_logic.js");

const checkOnly = process.argv.includes("--check");

function runSuites() {
  // The validator exits non-zero when any suite fails, which is correct for CI
  // and useless here - a failing suite is exactly what we need to record.
  let out;
  try {
    out = execFileSync("node", [VALIDATOR, "--all", "--json"], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    if (!e.stdout) throw e;
    out = e.stdout;
  }
  return JSON.parse(out);
}

function evalFileFor(id) {
  const hit = fs.readdirSync(EVALS_DIR).filter((f) => f.startsWith(`${id}-`) && f.endsWith(".json"));
  if (hit.length !== 1) return null;
  return path.join(EVALS_DIR, hit[0]);
}

function summarise(suite) {
  const failed = suite.checks.filter((c) => !c.ok);
  const head = `${suite.passed}/${suite.total} checks passed against the live instance.`;
  if (!failed.length) {
    // Name what was actually measured rather than only that it was fine, so a
    // passing eval still carries evidence instead of just a verdict.
    const evidence = suite.checks.map((c) => c.detail).join(" ");
    return `${head} ${evidence}`;
  }
  return `${head} FAILING: ${failed.map((c) => `${c.id} - ${c.detail}`).join(" | ")}`;
}

function main() {
  const suites = runSuites();
  let written = 0, drifted = 0, missing = 0;

  for (const suite of suites) {
    const file = evalFileFor(suite.id);
    if (!file) {
      console.log(`  ${suite.id}  no eval file found - skipped`);
      missing += 1;
      continue;
    }
    const ev = JSON.parse(fs.readFileSync(file, "utf8"));

    // The authored checks list is the eval's statement of intent; the suite is
    // what ran. If they disagree in size, one of them was edited without the
    // other and the eval is no longer describing its own validation.
    if (ev.validation.checks.length !== suite.checks.length) {
      console.log(`  ${suite.id}  WARNING: eval declares ${ev.validation.checks.length} checks, suite ran ${suite.checks.length}`);
    }

    const next = {
      ...ev,
      validation: {
        ...ev.validation,
        script: `tools/home-assistant-live/validate_logic.js --eval ${suite.id}`,
        result: summarise(suite),
        measured: suite.checks.map((c) => `${c.id} ${c.ok ? "PASS" : "FAIL"}: ${c.detail}`),
      },
      status: suite.passed === suite.total ? "pass" : "fail",
    };

    const before = fs.readFileSync(file, "utf8");
    const after = JSON.stringify(next, null, 2) + "\n";
    const same = before === after;
    if (!same) drifted += 1;

    const verdict = suite.passed === suite.total ? "PASS" : "FAIL";
    console.log(`  ${suite.id}  ${verdict}  ${suite.passed}/${suite.total}  ${same ? "unchanged" : (checkOnly ? "STALE" : "updated")}  ${path.basename(file)}`);

    if (!checkOnly && !same) {
      fs.writeFileSync(file, after);
      written += 1;
    }
  }

  const failing = suites.filter((s) => s.passed !== s.total).length;
  console.log(`\n${suites.length} suites, ${suites.length - failing} pass, ${failing} fail.`);
  if (checkOnly) {
    console.log(drifted ? `${drifted} eval file(s) STALE - re-run without --check.` : "All eval files match the live run.");
    process.exit(drifted || missing ? 1 : 0);
  }
  console.log(`${written} eval file(s) updated, ${missing} suite(s) without an eval file.`);
  process.exit(missing ? 1 : 0);
}

main();
