const fs = require("fs");

const path = "/Users/krasi/Projects/tf-home-lab/app/stacks/home-assistant/main.tf";
let text = fs.readFileSync(path, "utf8");

function timeBlock(prefix, defaults) {
  return `{% set ${prefix}_night_start_value = states('input_datetime.${prefix}_night_start') if states('input_datetime.${prefix}_night_start') not in ['unknown', 'unavailable', 'none'] else '${defaults.nightStart}' %}
{% set ${prefix}_day_start_value = states('input_datetime.${prefix}_day_start') if states('input_datetime.${prefix}_day_start') not in ['unknown', 'unavailable', 'none'] else '${defaults.dayStart}' %}
{% set ${prefix}_air_clean_start_value = states('input_datetime.${prefix}_air_clean_start') if states('input_datetime.${prefix}_air_clean_start') not in ['unknown', 'unavailable', 'none'] else '${defaults.airStart}' %}
{% set ${prefix}_air_clean_end_value = states('input_datetime.${prefix}_air_clean_end') if states('input_datetime.${prefix}_air_clean_end') not in ['unknown', 'unavailable', 'none'] else '${defaults.airEnd}' %}
{% set ${prefix}_night_start_parts = ${prefix}_night_start_value.split(':') %}
{% set ${prefix}_day_start_parts = ${prefix}_day_start_value.split(':') %}
{% set ${prefix}_air_clean_start_parts = ${prefix}_air_clean_start_value.split(':') %}
{% set ${prefix}_air_clean_end_parts = ${prefix}_air_clean_end_value.split(':') %}
{% set night_start_minutes = (${prefix}_night_start_parts[0] | int) * 60 + (${prefix}_night_start_parts[1] | int) %}
{% set day_start_minutes = (${prefix}_day_start_parts[0] | int) * 60 + (${prefix}_day_start_parts[1] | int) %}
{% set air_clean_start_minutes = (${prefix}_air_clean_start_parts[0] | int) * 60 + (${prefix}_air_clean_start_parts[1] | int) %}
{% set air_clean_end_minutes = (${prefix}_air_clean_end_parts[0] | int) * 60 + (${prefix}_air_clean_end_parts[1] | int) %}
{% set minutes_now = now().hour * 60 + now().minute %}
{% set night_sleep_window = minutes_now >= night_start_minutes and minutes_now < day_start_minutes %}
{% set night_air_clean_window = minutes_now >= air_clean_start_minutes and minutes_now < air_clean_end_minutes %}
{% set night_window = night_air_clean_window %}
{% set day_air_clean_window = minutes_now >= day_start_minutes and minutes_now <= 1439 %}`;
}

text = text.replace(
  `{% set minutes_now = now().hour * 60 + now().minute %}
{% set night_sleep_window = minutes_now >= 30 and minutes_now < 510 %}
{% set night_air_clean_window = minutes_now >= 180 and minutes_now < 360 %}
{% set night_window = night_air_clean_window %}
{% set day_air_clean_window = now().hour >= 8 and now().hour <= 23 %}`,
  timeBlock("livingr", {
    nightStart: "00:30:00",
    dayStart: "08:30:00",
    airStart: "03:00:00",
    airEnd: "06:00:00",
  }),
);

text = text.replace(
  `{% set minutes_now = now().hour * 60 + now().minute %}
{% set night_sleep_window = minutes_now >= 30 and minutes_now < 510 %}
{% set night_air_clean_window = minutes_now >= 180 and minutes_now < 360 %}
{% set night_window = night_air_clean_window %}
{% set day_air_clean_window = now().hour >= 8 and now().hour <= 23 %}`,
  timeBlock("bedroomb", {
    nightStart: "00:30:00",
    dayStart: "08:30:00",
    airStart: "03:00:00",
    airEnd: "06:00:00",
  }),
);

text = text.replace(
  "target={{ target }}, start_delta={{ cooling_start_delta }},",
  "target={{ target }}, night_start={{ livingr_night_start_value }}, day_start={{ livingr_day_start_value }}, air_clean={{ livingr_air_clean_start_value }}-{{ livingr_air_clean_end_value }}, start_delta={{ cooling_start_delta }},",
);

text = text.replace(
  "target={{ target }}, cooling_delta={{ active_cooling_start_delta }},",
  "target={{ target }}, night_start={{ bedroomb_night_start_value }}, day_start={{ bedroomb_day_start_value }}, air_clean={{ bedroomb_air_clean_start_value }}-{{ bedroomb_air_clean_end_value }}, cooling_delta={{ active_cooling_start_delta }},",
);

fs.writeFileSync(path, text);
