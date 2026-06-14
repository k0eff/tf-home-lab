const { rest } = require("./ha_ws_util");

function patchText(text) {
  return text
    .replace(
      "{{ night_sleep_window and not night_air_clean_window and states('climate.hol_2') != 'off' }}",
      "{{ night_sleep_window and not night_air_clean_window and states('climate.hol_2') != 'off' and not (climate_mode == 'summer' and effective is not none and target is not none and effective >= target + active_cooling_start_delta) and not (climate_mode == 'winter' and effective is not none and target is not none and effective <= target - active_winter_start_delta) }}",
    )
    .replace(
      "Night sleep: climate off outside 03:00-06:00 air-clean window;",
      "Night comfort band: climate off until room leaves the configured night band;",
    )
    .replace(
      "{{ not night_sleep_window and climate_mode == 'summer' and effective is not none and target is not none and effective >= target + active_cooling_start_delta and dynamic_setpoint is not none }}",
      "{{ not night_air_clean_window and climate_mode == 'summer' and effective is not none and target is not none and effective >= target + active_cooling_start_delta and dynamic_setpoint is not none }}",
    )
    .replace(
      "{{ not night_sleep_window and climate_mode == 'winter' and effective is not none and target is not none and effective <= target - active_winter_start_delta and dynamic_setpoint is not none }}",
      "{{ not night_air_clean_window and climate_mode == 'winter' and effective is not none and target is not none and effective <= target - active_winter_start_delta and dynamic_setpoint is not none }}",
    );
}

function patch(value) {
  if (Array.isArray(value)) return value.map(patch);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, patch(child)]));
  }
  if (typeof value === "string") return patchText(value);
  return value;
}

(async () => {
  const id = "1770077000010";
  const cfg = await rest(`/api/config/automation/config/${id}`);
  const patched = patch(cfg);
  await rest(`/api/config/automation/config/${id}`, "POST", patched);
  await rest("/api/services/automation/reload", "POST", {});
  console.log(JSON.stringify({ updated: true }, null, 2));
})();
