const fs = require("fs");

const path = "/Users/krasi/Projects/tf-home-lab/app/stacks/home-assistant/main.tf";
const text = fs.readFileSync(path, "utf8");
if (text.includes("test_aircon_bedroomb_room_sensor_comfort_band")) {
  process.exit(0);
}

const localStart = text.indexOf("locals {\n  livingr_climate_test_setup");
if (localStart === -1) throw new Error("LivingR locals start not found");
const resourceStart = text.indexOf('\nresource "homeassistant_automation" "test_aircon_livingr_room_sensor_comfort_band"', localStart);
if (resourceStart === -1) throw new Error("LivingR resource start not found");

const sourceBlock = text.slice(localStart, text.length);
let block = sourceBlock;
block = block.replace(/^locals \{\n/, "locals {\n");
block = block.replaceAll("livingr_climate_test_setup", "bedroomb_climate_test_setup");
block = block.replaceAll("livingr_climate_test_log_suffix", "bedroomb_climate_test_log_suffix");
block = block.replaceAll("input_number.livingr_", "input_number.bedroomb_");
block = block.replaceAll("climate.hol_2", "climate.v357_spalniag_2");
block = block.replaceAll("binary_sensor.motion01", "binary_sensor.motion03");
block = block.replaceAll("LivingR", "BedroomB");
block = block.replaceAll("livingr", "bedroomb");
block = block.replaceAll("Living tv 1", "BdrmB 11");
block = block.replaceAll("Living R", "BedroomB");
block = block.replaceAll("Living room", "BedroomB");
block = block.replaceAll("AirCon - BedroomB - room sensor comfort band", "AirCon - BedroomB - room sensor comfort band");
block = block.replace(
  'resource "homeassistant_automation" "test_aircon_bedroomb_room_sensor_comfort_band"',
  'resource "homeassistant_automation" "test_aircon_bedroomb_room_sensor_comfort_band"'
);
block = block.replace(
  "Test automation for BedroomB climate.v357_spalniag_2. Uses BdrmB 11 temperature sensor while its battery is above the configurable room-sensor battery helper; falls back to climate current_temperature below that.",
  "Test automation for BedroomB climate.v357_spalniag_2. Uses BdrmB 11 as the primary room temperature sensor while its battery is above the configurable room-sensor battery helper; falls back to BedroomB ceil 2 if healthy, then to climate current_temperature."
);
block = block.replace(
  "{% set room = states('sensor.miaomiaoce_t2_1228_temperature_humidity_sensor') | float(none) %}\n{% set battery = states('sensor.miaomiaoce_t2_1228_battery_level') | float(0) %}\n{% set ac_temp = state_attr('climate.v357_spalniag_2', 'current_temperature') | float(none) %}",
  "{% set primary_room = states('sensor.miaomiaoce_t2_5249_temperature_humidity_sensor') | float(none) %}\n{% set primary_battery = states('sensor.miaomiaoce_t2_5249_battery_level') | float(0) %}\n{% set secondary_room = states('sensor.miaomiaoce_t2_faea_temperature_humidity_sensor') | float(none) %}\n{% set secondary_battery = states('sensor.miaomiaoce_t2_faea_battery_level') | float(0) %}\n{% set ac_temp = state_attr('climate.v357_spalniag_2', 'current_temperature') | float(none) %}"
);
block = block.replace(
  "{% set mild_summer_target = states('input_number.bedroomb_target_temperature') | float(23.9) %}",
  "{% set mild_summer_target = states('input_number.bedroomb_target_temperature') | float(23.5) %}"
);
block = block.replace(
  "{% set hot_summer_target = states('input_number.bedroomb_hot_summer_target') | float(24.0) %}",
  "{% set hot_summer_target = states('input_number.bedroomb_hot_summer_target') | float(23.8) %}"
);
block = block.replace(
  "{% set source = 'room_sensor' if battery > room_sensor_min_battery and room is not none else 'climate_fallback' %}\n{% set effective = room if source == 'room_sensor' else ac_temp %}",
  "{% if primary_battery > room_sensor_min_battery and primary_room is not none %}\n  {% set source = 'primary_room_sensor' %}\n  {% set room = primary_room %}\n  {% set battery = primary_battery %}\n{% elif secondary_battery > room_sensor_min_battery and secondary_room is not none %}\n  {% set source = 'ceiling_room_sensor' %}\n  {% set room = secondary_room %}\n  {% set battery = secondary_battery %}\n{% else %}\n  {% set source = 'climate_fallback' %}\n  {% set room = none %}\n  {% set battery = primary_battery %}\n{% endif %}\n{% set effective = room if source in ['primary_room_sensor', 'ceiling_room_sensor'] else ac_temp %}"
);
block = block.replace(
  "room={{ room }}, room_battery={{ battery }}%, ac_sensor={{ ac_temp }}",
  "primary_room={{ primary_room }}, primary_battery={{ primary_battery }}%, ceiling_room={{ secondary_room }}, ceiling_battery={{ secondary_battery }}%, source_room={{ room }}, source_battery={{ battery }}%, ac_sensor={{ ac_temp }}"
);
block = block.replaceAll("sensor.miaomiaoce_t2_1228_temperature_humidity_sensor", "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor");
block = block.replaceAll("sensor.miaomiaoce_t2_1228_battery_level", "sensor.miaomiaoce_t2_5249_battery_level");
block = block.replaceAll("livingr_no_motion_15m", "bedroomb_no_motion_15m");
block = block.replaceAll("livingr_motion", "bedroomb_motion");
block = block.replaceAll("Night air cleaning: fan_only fan 5", "Night air cleaning: fan_only fan 5");
block = block.replaceAll("fan_only fan 2 coil cool-down", "fan_only configured coil cool-down");
block = block.replaceAll("Winter: heat when room is below 21.5C and outside mode is winter", "Winter: heat when room is below target band and outside mode is winter");

block = block.replace(
  `{
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor"
      "for" = {
        minutes = 3
      }
      id = "room_temperature_stable_change"
    },
    {
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_5249_battery_level"
      id        = "room_sensor_battery_changed"
    },`,
  `{
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_5249_temperature_humidity_sensor"
      "for" = {
        minutes = 3
      }
      id = "primary_room_temperature_stable_change"
    },
    {
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_5249_battery_level"
      id        = "primary_room_sensor_battery_changed"
    },
    {
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_faea_temperature_humidity_sensor"
      "for" = {
        minutes = 3
      }
      id = "ceiling_room_temperature_stable_change"
    },
    {
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_faea_battery_level"
      id        = "ceiling_room_sensor_battery_changed"
    },`
);

block = block.replace(/^locals \{\n/, "\nlocals {\n");
fs.writeFileSync(path, `${text.trimEnd()}\n${block}\n`);
