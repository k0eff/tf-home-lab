// Mirrors the 2026-08-14 BedroomS dead-zone fix into main.tf, so a future
// `terraform apply` cannot revert it:
//   apply_bedrooms_fixed_cooling_engaged_latch.js
//
// Three edits, all scoped to the test_aircon_bedrooms_room_sensor_comfort_band
// resource block (brace-matched): the exclusion clause is byte-identical nowhere
// else today, but the slice keeps the blast radius explicit regardless.
//
//   1. the fixed-cooling branch turns the engagement latch on when it runs
//   2. the three ordinary summer branches defer to that latch instead of to the
//      intent test (window + toggle + not away)
//   3. a new bookkeeping step releases the latch once the intent stops holding
//
// Edit order matters: the release step's own predicate IS the old intent clause
// verbatim, so it must be inserted only after the three clause rewrites, or it
// becomes a fourth match and rewrites the condition it depends on.
//
// main.tf stores each multi-line Jinja template as ONE physical HCL line with
// literal 2-char "\n" sequences rather than real newline bytes. The release
// step's template is therefore built by slicing the fixed-cooling branch's own
// condition line, which guarantees an identical variable prelude with no drift.
//
// main.tf spells service calls "service"; the live JSON spells them "action".
// Each side keeps its own convention here, as elsewhere in this repo.
//
// One-off; not meant to be re-run (it asserts expected match counts and refuses
// to write if they do not hold).
//
// Run: node backport_bedrooms_fixed_cooling_latch_terraform.js

const fs = require("fs");
const path = require("path");

const MAIN_TF = path.join(__dirname, "..", "..", "app", "stacks", "home-assistant", "main.tf");
const RESOURCE = 'resource "homeassistant_automation" "test_aircon_bedrooms_room_sensor_comfort_band" {';
const LATCH = "input_boolean.bedrooms_fixed_cooling_engaged";
const BRANCH_ALIAS = '"alias" = "Summer: night fixed-cooling — force continuous cool once at window start"';

const OLD_CLAUSE = "not (summer_night_window and is_state('input_boolean.bedrooms_night_fixed_cooling', 'on') and not away)";
const NEW_CLAUSE = `not is_state('${LATCH}', 'on')`;
const EXPECTED_CLAUSES = 3;

const SEQUENCE_TAIL = `              "data" = {
                "temperature" = "{{ states('input_number.bedrooms_night_fixed_cooling_target') | float(24) }}"
              }
            }
          ]`;

const SEQUENCE_TAIL_PATCHED = `              "data" = {
                "temperature" = "{{ states('input_number.bedrooms_night_fixed_cooling_target') | float(24) }}"
              }
            },
            {
              "service" = "input_boolean.turn_on"
              "target" = {
                "entity_id" = "${LATCH}"
              }
            }
          ]`;

const CHOOSE_ANCHOR = `    # Day/night/summer/winter comfort-band state machine for this room's climate
    # entity, same shape as LivingR's, PLUS one branch unique to this room: a`;

function resourceSlice(text) {
  const start = text.indexOf(RESOURCE);
  if (start === -1) throw new Error("BedroomS resource block not found");
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") { i += 1; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth += 1;
    else if (c === "}") { depth -= 1; if (depth === 0) return { start, end: i + 1 }; }
  }
  throw new Error("unterminated BedroomS resource block");
}

function assertCount(block, needle, expect, label) {
  const found = block.split(needle).length - 1;
  if (found !== expect) throw new Error(`${label}: expected ${expect} occurrences, found ${found}`);
}

// Pull the fixed-cooling branch's condition template verbatim (still HCL-escaped)
// and swap its trailing expression for the release predicate.
function releaseTemplate(block) {
  const aliasIdx = block.indexOf(BRANCH_ALIAS);
  if (aliasIdx === -1) throw new Error("fixed-cooling branch alias not found");
  const vtIdx = block.indexOf('"value_template" = "', aliasIdx);
  if (vtIdx === -1) throw new Error("branch value_template not found");
  const openQuote = vtIdx + '"value_template" = "'.length;
  const lineEnd = block.indexOf("\n", openQuote);
  const raw = block.slice(openQuote, lineEnd).replace(/"$/, "");
  const exprIdx = raw.lastIndexOf("{{");
  if (exprIdx <= 0) throw new Error("no trailing expression in branch condition");
  return raw.slice(0, exprIdx) + `{{ ${OLD_CLAUSE} }}`;
}

function patch(text) {
  const { start, end } = resourceSlice(text);
  let block = text.slice(start, end);

  // captured before any rewrite, so the prelude reflects the real branch template
  const releaseVt = releaseTemplate(block);

  // 1. branch sets the latch
  assertCount(block, SEQUENCE_TAIL, 1, "fixed-cooling sequence tail");
  if (block.includes(LATCH)) throw new Error("latch already referenced — already patched?");
  block = block.replace(SEQUENCE_TAIL, SEQUENCE_TAIL_PATCHED);

  // 2. ordinary branches defer to the latch (before the release step exists)
  assertCount(block, OLD_CLAUSE, EXPECTED_CLAUSES, "exclusion clause");
  block = block.split(OLD_CLAUSE).join(NEW_CLAUSE);

  // 3. release step, inserted ahead of the outer choose
  assertCount(block, CHOOSE_ANCHOR, 1, "outer choose anchor");
  const releaseStep = `    # Releases the fixed-cooling engagement latch as soon as fixed cooling is no
    # longer entitled to hold the unit (window over, toggle off, or the room went
    # away). The latch itself is set by the fixed-cooling branch below when it
    # actually runs. The three ordinary summer branches defer to the latch rather
    # than to this predicate directly: fixed cooling is trigger-id gated and gets
    # one shot per window, so testing intent left them blocked all night whenever
    # that shot was missed - the 2026-08-14 dead zone. Testing the latch means a
    # missed shot leaves them free to run normally.
    {
      "alias" = "Track fixed-cooling engagement latch"
      "if" = [
        {
          "condition" = "template"
          "value_template" = "${releaseVt}"
        }
      ]
      "then" = [
        {
          "service" = "input_boolean.turn_off"
          "target" = {
            "entity_id" = "${LATCH}"
          }
        }
      ]
    },
`;
  block = block.replace(CHOOSE_ANCHOR, releaseStep + CHOOSE_ANCHOR);

  return text.slice(0, start) + block + text.slice(end);
}

if (require.main === module) {
  const before = fs.readFileSync(MAIN_TF, "utf8");
  const after = patch(before);
  fs.writeFileSync(MAIN_TF, after);
  console.log(JSON.stringify({
    file: path.relative(process.cwd(), MAIN_TF),
    latch: LATCH,
    exclusion_clauses_rewritten: EXPECTED_CLAUSES,
    bytes_delta: after.length - before.length,
  }, null, 2));
}

module.exports = { patch, OLD_CLAUSE, NEW_CLAUSE, LATCH };
