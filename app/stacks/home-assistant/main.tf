resource "homeassistant_automation" "aircon_bedroomb_flap_door_sensor" {
  alias       = "Aircon - BedroomB - flap swing - door sensor"
  description = "Prevents aircon flap from staying open in SpalniaG. Robust trigger with 3s debounce and 10m retry."
  mode        = "single"
  trigger     = "[{\"platform\": \"state\", \"entity_id\": \"binary_sensor.isa_dw2hl_af8f_magnet_sensor\", \"to\": \"on\", \"for\": {\"seconds\": 3}}, {\"platform\": \"time_pattern\", \"minutes\": \"/10\"}]"
  condition   = "[{\"condition\": \"state\", \"entity_id\": \"binary_sensor.isa_dw2hl_af8f_magnet_sensor\", \"state\": \"on\"}]"
  action      = "[{\"if\": [{\"condition\": \"state\", \"entity_id\": \"climate.v357_spalniag\", \"attribute\": \"swing_mode\", \"state\": \"4\"}], \"then\": [{\"service\": \"climate.set_swing_mode\", \"data\": {\"swing_mode\": \"5_down\"}, \"target\": {\"entity_id\": \"climate.v357_spalniag\"}}], \"else\": [{\"service\": \"climate.set_swing_mode\", \"data\": {\"swing_mode\": \"4\"}, \"target\": {\"entity_id\": \"climate.v357_spalniag\"}}]}]"
}

resource "homeassistant_automation" "aircon_bedrooms_fan_high_no_motion" {
  alias       = "Aircon - BedroomS - fan HIGH - no motion"
  mode        = "single"
  trigger     = "[{\"platform\": \"state\", \"entity_id\": [\"binary_sensor.motion04spalniam\"], \"from\": \"on\", \"to\": \"off\", \"for\": {\"hours\": 0, \"minutes\": 15, \"seconds\": 0}}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().hour >= 9 and now().hour <= 23 }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"8c3cbe9fa16235f7f160345c7e7d9b2d\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"8c3cbe9fa16235f7f160345c7e7d9b2d\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat\"}, {\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"8c3cbe9fa16235f7f160345c7e7d9b2d\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}]}]"
  action      = "[{\"service\": \"climate.set_fan_mode\", \"data\": {\"fan_mode\": \"5\"}, \"target\": {\"entity_id\": \"climate.v537_spalniam\"}}]"
}

resource "homeassistant_automation" "aircon_bedrooms_fan_mid_motion" {
  alias       = "Aircon - BedroomS - fan MID - motion"
  mode        = "single"
  trigger     = "[{\"platform\": \"state\", \"entity_id\": [\"binary_sensor.motion04spalniam\"], \"from\": \"off\", \"to\": \"on\", \"for\": {\"hours\": 0, \"minutes\": 0, \"seconds\": 0}}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().hour >= 9 and now().hour <= 23 }}\", \"enabled\": false}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"8c3cbe9fa16235f7f160345c7e7d9b2d\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"8c3cbe9fa16235f7f160345c7e7d9b2d\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat\"}, {\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"8c3cbe9fa16235f7f160345c7e7d9b2d\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}]}]"
  action      = "[{\"service\": \"climate.set_fan_mode\", \"data\": {\"fan_mode\": \"auto\"}, \"target\": {\"entity_id\": \"climate.v537_spalniam\"}}]"
}

resource "homeassistant_automation" "aircon_bedrooms_flap_down" {
  alias       = "AirCon - bedroomS - flap vane down v2"
  mode        = "single"
  trigger     = "[{\"platform\": \"time_pattern\", \"minutes\": \"/28\"}]"
  condition   = "[{\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"climate.v537_spalniam\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"template\", \"value_template\": \"{{ now().month >= 4 or now().month <= 10 }}\"}]"
  action      = "[{\"if\": [{\"condition\": \"state\", \"entity_id\": \"climate.v537_spalniam\", \"attribute\": \"swing_mode\", \"state\": \"4\"}], \"then\": [{\"service\": \"climate.set_swing_mode\", \"data\": {\"swing_mode\": \"5_down\"}, \"target\": {\"entity_id\": \"climate.v537_spalniam\"}}], \"else\": [{\"service\": \"climate.set_swing_mode\", \"data\": {\"swing_mode\": \"4\"}, \"target\": {\"entity_id\": \"climate.v537_spalniam\"}}]}]"
}

resource "homeassistant_automation" "aircon_enter_home" {
  alias       = "AirCon enter home set temp"
  mode        = "single"
  trigger     = "[{\"platform\": \"device\", \"device_id\": \"6c73c88c22f0e954d7c9395fbabffdc1\", \"domain\": \"device_tracker\", \"entity_id\": \"device_tracker.fold_4\", \"type\": \"enters\", \"zone\": \"zone.home_2\"}, {\"platform\": \"device\", \"device_id\": \"72b011baafff5f5910257fe7b8edcdce\", \"domain\": \"device_tracker\", \"entity_id\": \"4596683387e3ffad9f6f3a64f810cba5\", \"type\": \"enters\", \"zone\": \"zone.home_2\"}]"
  condition   = "[{\"condition\": \"and\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"6c73c88c22f0e954d7c9395fbabffdc1\", \"domain\": \"device_tracker\", \"entity_id\": \"device_tracker.fold_4\", \"type\": \"is_not_home\"}, {\"condition\": \"device\", \"device_id\": \"72b011baafff5f5910257fe7b8edcdce\", \"domain\": \"device_tracker\", \"entity_id\": \"4596683387e3ffad9f6f3a64f810cba5\", \"type\": \"is_not_home\"}]}, {\"condition\": \"and\", \"conditions\": []}]"
  action      = "[{\"condition\": \"and\", \"conditions\": [{\"condition\": \"template\", \"value_template\": \"{{ not is_state('sensor.iphone_ssid', '512KB') }}\"}, {\"condition\": \"template\", \"value_template\": \"{{ not is_state('sensor.fold_4_public_ip_address', '151.251.104.115') }}\"}, {\"condition\": \"and\", \"conditions\": [{\"condition\": \"state\", \"entity_id\": \"climate.hol\", \"state\": \"cool\"}, {\"condition\": \"state\", \"entity_id\": \"climate.v357_spalniag\", \"state\": \"cool\"}, {\"condition\": \"state\", \"entity_id\": \"climate.v537_spalniam\", \"state\": \"cool\"}]}]}, {\"service\": \"climate.set_temperature\", \"data\": {\"temperature\": 24}, \"target\": {\"entity_id\": [\"climate.hol\", \"climate.v537_spalniam\", \"climate.v357_spalniag\"]}}, {\"delay\": {\"hours\": 0, \"minutes\": 15, \"seconds\": 0, \"milliseconds\": 0}}, {\"service\": \"climate.set_temperature\", \"data\": {\"temperature\": 25.5}, \"target\": {\"entity_id\": [\"climate.hol\", \"climate.v537_spalniam\", \"climate.v357_spalniag\"]}}]"
}

resource "homeassistant_automation" "aircon_hol_fan_high_no_motion" {
  alias       = "Aircon - LivingR - fan HIGH no motion"
  mode        = "single"
  trigger     = "[{\"platform\": \"state\", \"entity_id\": [\"binary_sensor.motion01\"], \"from\": \"on\", \"to\": \"off\", \"for\": {\"hours\": 0, \"minutes\": 15, \"seconds\": 0}}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().hour >= 8 and now().hour <= 23 }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat\"}]}]"
  action      = "[{\"service\": \"climate.set_fan_mode\", \"data\": {\"fan_mode\": \"5\"}, \"target\": {\"entity_id\": \"climate.hol\"}}]"
}

resource "homeassistant_automation" "aircon_hol_fan_mid_motion" {
  alias       = "Aircon - LivingR - fan MID motion"
  mode        = "single"
  trigger     = "[{\"platform\": \"state\", \"entity_id\": [\"binary_sensor.motion01\"], \"from\": \"off\", \"to\": \"on\", \"for\": {\"hours\": 0, \"minutes\": 0, \"seconds\": 0}}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().hour >= 8 and now().hour <= 23 }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat\"}]}]"
  action      = "[{\"service\": \"climate.set_fan_mode\", \"data\": {\"fan_mode\": \"3\"}, \"target\": {\"entity_id\": \"climate.hol\"}}]"
}

resource "homeassistant_automation" "aircon_leave_home" {
  alias       = "AirCon leave home set temp"
  mode        = "single"
  trigger     = "[{\"platform\": \"device\", \"device_id\": \"6c73c88c22f0e954d7c9395fbabffdc1\", \"domain\": \"device_tracker\", \"entity_id\": \"device_tracker.fold_4\", \"type\": \"leaves\", \"zone\": \"zone.home_2\"}, {\"platform\": \"device\", \"device_id\": \"72b011baafff5f5910257fe7b8edcdce\", \"domain\": \"device_tracker\", \"entity_id\": \"4596683387e3ffad9f6f3a64f810cba5\", \"type\": \"leaves\", \"zone\": \"zone.home_2\"}]"
  condition   = "[{\"condition\": \"and\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"6c73c88c22f0e954d7c9395fbabffdc1\", \"domain\": \"device_tracker\", \"entity_id\": \"device_tracker.fold_4\", \"type\": \"is_not_home\"}, {\"condition\": \"device\", \"device_id\": \"72b011baafff5f5910257fe7b8edcdce\", \"domain\": \"device_tracker\", \"entity_id\": \"4596683387e3ffad9f6f3a64f810cba5\", \"type\": \"is_not_home\"}]}, {\"condition\": \"and\", \"conditions\": [], \"enabled\": false}, {\"condition\": \"and\", \"conditions\": [{\"condition\": \"state\", \"entity_id\": \"climate.hol\", \"state\": \"cool\"}, {\"condition\": \"state\", \"entity_id\": \"climate.v357_spalniag\", \"state\": \"cool\"}, {\"condition\": \"state\", \"entity_id\": \"climate.v537_spalniam\", \"state\": \"cool\"}]}]"
  action      = "[{\"delay\": {\"hours\": 0, \"minutes\": 15, \"seconds\": 0, \"milliseconds\": 0}}, {\"condition\": \"and\", \"conditions\": [{\"condition\": \"template\", \"value_template\": \"{{ not is_state('sensor.iphone_ssid', '512KB') }}\"}, {\"condition\": \"template\", \"value_template\": \"{{ not is_state('sensor.fold_4_public_ip_address', '151.251.104.115') }}\"}]}, {\"service\": \"climate.set_temperature\", \"data\": {\"temperature\": 28}, \"target\": {\"entity_id\": [\"climate.hol\", \"climate.v537_spalniam\", \"climate.v357_spalniag\"]}}]"
}

resource "homeassistant_automation" "aircon_living_r_flap_down_v2" {
  alias       = "AirCon - Bedroom B - flap vane down v2"
  mode        = "single"
  trigger     = "[{\"platform\": \"time_pattern\", \"minutes\": \"/5\"}]"
  condition   = "[{\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"template\", \"value_template\": \"{{ now().month >= 4 or now().month <= 10 }}\"}]"
  action      = "[{\"if\": [{\"condition\": \"state\", \"entity_id\": \"climate.v357_spalniag\", \"attribute\": \"swing_mode\", \"state\": \"4\"}], \"then\": [{\"service\": \"climate.set_swing_mode\", \"data\": {\"swing_mode\": \"5_down\"}, \"target\": {\"entity_id\": [\"climate.v357_spalniag\"]}}, {\"service\": \"melcloud.set_vane_horizontal\", \"metadata\": {}, \"data\": {\"position\": \"split\"}, \"target\": {\"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\"}}], \"else\": [{\"service\": \"climate.set_swing_mode\", \"data\": {\"swing_mode\": \"4\"}, \"target\": {\"entity_id\": [\"climate.v357_spalniag\"]}}]}]"
}

resource "homeassistant_automation" "aircon_living_r_flap_down_v2_2" {
  alias       = "AirCon - Living R - flap vane down v2, horiz split"
  mode        = "single"
  trigger     = "[{\"platform\": \"time_pattern\", \"minutes\": \"/4\"}]"
  condition   = "[{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"template\", \"value_template\": \"{{ now().month >= 4 or now().month <= 10 }}\"}]"
  action      = "[{\"if\": [{\"condition\": \"state\", \"entity_id\": \"climate.hol\", \"attribute\": \"swing_mode\", \"state\": \"4\"}], \"then\": [{\"service\": \"climate.set_swing_mode\", \"data\": {\"swing_mode\": \"5_down\"}, \"target\": {\"entity_id\": [\"climate.hol\"]}}, {\"service\": \"melcloud.set_vane_horizontal\", \"metadata\": {}, \"data\": {\"position\": \"split\"}, \"target\": {\"area_id\": \"living_room\"}}], \"else\": [{\"service\": \"climate.set_swing_mode\", \"data\": {\"swing_mode\": \"4\"}, \"target\": {\"entity_id\": [\"climate.hol\"]}}]}]"
}

resource "homeassistant_automation" "aircon_livingr_morning_set_temp_winter" {
  alias       = "AirCon - LivingR - morning - set temp - winter"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"08:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ (now().month >= 1 and now().month <= 4) or (now().month >= 11) }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat_cool\"}]}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"hvac_mode\": \"heat\", \"temperature\": 22}, \"target\": {\"entity_id\": [\"climate.hol\"]}}, {\"service\": \"climate.set_fan_mode\", \"data\": {\"fan_mode\": \"auto\"}, \"target\": {\"entity_id\": \"climate.hol\"}}]"
}

resource "homeassistant_automation" "aircon_livingr_night_set_fan" {
  alias       = "Aircon - LivingR - night - set fan - summer"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"00:30:00\"}]"
  condition   = "[{\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}]}]"
  action      = "[{\"service\": \"climate.set_fan_mode\", \"data\": {\"fan_mode\": \"5\"}, \"target\": {\"entity_id\": \"climate.hol\"}}]"
}

resource "homeassistant_automation" "aircon_livingr_night_set_temp_winter" {
  alias       = "AirCon - LivingR - night - set temp - winter"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"00:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ (now().month >= 0 and now().month <= 4) or (now().month >= 11) }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat_cool\"}]}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"hvac_mode\": \"fan_only\", \"temperature\": 19}, \"target\": {\"entity_id\": [\"climate.hol\"]}}]"
}

resource "homeassistant_automation" "aircon_morning_bedroomb_winter" {
  alias       = "AirCon - morning - BedroomB - winter"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"08:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ (now().month >= 1 and now().month <= 4) or (now().month >= 11) }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat_cool\"}, {\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}, {\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat\"}]}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"hvac_mode\": \"heat\", \"temperature\": 22}, \"target\": {\"entity_id\": [\"climate.v357_spalniag\"]}}, {\"service\": \"climate.set_fan_mode\", \"target\": {\"entity_id\": [\"climate.v357_spalniag\"]}, \"data\": {\"fan_mode\": \"auto\"}}]"
}

resource "homeassistant_automation" "aircon_night_bedroomb_winter" {
  alias       = "Aircon - night - BedroomB - winter"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"00:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ (now().month >= 1 and now().month <= 4) or (now().month >= 11) }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat\"}, {\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat_cool\"}, {\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}]}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"hvac_mode\": \"heat\", \"temperature\": 19}, \"target\": {\"entity_id\": [\"climate.v357_spalniag\"]}}, {\"service\": \"climate.set_fan_mode\", \"data\": {\"fan_mode\": \"Auto\"}, \"target\": {\"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\"}}]"
}

resource "homeassistant_automation" "aircon_night_spalniag" {
  alias       = "Aircon - night - BedroomB - summer"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"00:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().month >= 5 and now().month <= 10 }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\", \"enabled\": false}, {\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"climate.v537_spalniam\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\", \"enabled\": false}]}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"hvac_mode\": \"cool\", \"temperature\": 28}, \"target\": {\"entity_id\": [\"climate.v357_spalniag\"]}}, {\"service\": \"climate.set_fan_mode\", \"data\": {\"fan_mode\": \"5\"}, \"target\": {\"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\"}}]"
}

resource "homeassistant_automation" "aircon_night_spalniam" {
  alias       = "Aircon - night - BedroomS - summer"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"00:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().month >= 5 and now().month <= 10 }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"climate.v537_spalniam\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}]}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"temperature\": 24.5, \"hvac_mode\": \"cool\"}, \"target\": {\"entity_id\": [\"climate.v537_spalniam\"]}}]"
}

resource "homeassistant_automation" "aircon_restore_comfort_in_the_morning" {
  alias       = "AirCon - morning - BedroomB - summer"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"08:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().month >= 5 and now().month <= 10 }}\"}, {\"condition\": \"device\", \"device_id\": \"ce91fbd41dac2265588915a71f8a8e46\", \"domain\": \"climate\", \"entity_id\": \"climate.v357_spalniag\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"hvac_mode\": \"cool\", \"temperature\": 25.5}, \"target\": {\"entity_id\": [\"climate.v357_spalniag\"]}}, {\"service\": \"climate.set_fan_mode\", \"target\": {\"entity_id\": [\"climate.v357_spalniag\"]}, \"data\": {\"fan_mode\": \"auto\"}}]"
}

resource "homeassistant_automation" "aircon_save_energy_at_night" {
  alias       = "AirCon - LivingR - night - set temp - summer"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"00:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().month >= 5 and now().month <= 10 }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}]}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"hvac_mode\": \"fan_only\", \"temperature\": 30}, \"target\": {\"entity_id\": [\"climate.hol\"]}}]"
}

resource "homeassistant_automation" "antre_motion" {
  alias       = "Light-Entry-motion-turn-on-motion"
  mode        = "single"
  trigger     = "[{\"type\": \"motion\", \"platform\": \"device\", \"device_id\": \"3f805142260963ffa9a411b20f20ce56\", \"entity_id\": \"104a8b727cfb30b0a3862f5f1b0a0069\", \"domain\": \"binary_sensor\"}]"
  action      = "[{\"service\": \"light.turn_on\", \"data\": {}, \"target\": {\"entity_id\": \"light.sonoff_100110aad7\"}}]"
}

resource "homeassistant_automation" "hol" {
  alias       = "AirCon - LivingR - morning - set temp - summer"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"08:30:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().month >= 5 and now().month <= 10 }}\"}, {\"condition\": \"or\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"climate.hol\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"fan_only\"}, {\"condition\": \"device\", \"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\", \"domain\": \"climate\", \"entity_id\": \"e00fdc2347e5e16f9c5aa6da621f8261\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"heat_cool\"}]}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"hvac_mode\": \"cool\", \"temperature\": 25.5}, \"target\": {\"entity_id\": [\"climate.hol\"]}}]"
}

resource "homeassistant_automation" "hol_hidden_light_off" {
  alias       = "Hol - hidden light - off"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"01:00:00\"}]"
  action      = "[{\"type\": \"turn_off\", \"device_id\": \"8db06a169c10131ef061f477869c25c2\", \"entity_id\": \"36c12df377ab1cae6eaccc06c28fcc69\", \"domain\": \"light\"}]"
}

resource "homeassistant_automation" "hol_sunset_hidden_light" {
  alias       = "Hol - hidden light - on - sunset"
  mode        = "single"
  trigger     = "[{\"platform\": \"sun\", \"event\": \"sunset\", \"offset\": 0}]"
  action      = "[{\"type\": \"turn_on\", \"device_id\": \"8db06a169c10131ef061f477869c25c2\", \"entity_id\": \"36c12df377ab1cae6eaccc06c28fcc69\", \"domain\": \"light\"}]"
}

resource "homeassistant_automation" "light_bania_off" {
  alias       = "Light - bania - OFF"
  mode        = "single"
  trigger     = "[{\"type\": \"no_motion\", \"platform\": \"device\", \"device_id\": \"ff5c70563ac3d0be9c0edbe3f428b7cf\", \"entity_id\": \"bdb9b10ba7d5c3e9e0d094c84b00e2db\", \"domain\": \"binary_sensor\", \"for\": {\"hours\": 0, \"minutes\": 1, \"seconds\": 30}}]"
  action      = "[{\"service\": \"light.turn_off\", \"data\": {}, \"target\": {\"entity_id\": \"light.sonoff_10013c0c64\"}}]"
}

resource "homeassistant_automation" "light_bania_on" {
  alias       = "Light - bania - ON"
  mode        = "single"
  trigger     = "[{\"type\": \"motion\", \"platform\": \"device\", \"device_id\": \"ff5c70563ac3d0be9c0edbe3f428b7cf\", \"entity_id\": \"bdb9b10ba7d5c3e9e0d094c84b00e2db\", \"domain\": \"binary_sensor\"}]"
  action      = "[{\"service\": \"light.turn_on\", \"data\": {}, \"target\": {\"entity_id\": \"light.sonoff_10013c0c64\"}}]"
}

resource "homeassistant_automation" "light_entry_turn_off_motion" {
  alias       = "Light-Entry-motion-turn-off-motion"
  mode        = "single"
  trigger     = "[{\"type\": \"no_motion\", \"platform\": \"device\", \"device_id\": \"3f805142260963ffa9a411b20f20ce56\", \"entity_id\": \"104a8b727cfb30b0a3862f5f1b0a0069\", \"domain\": \"binary_sensor\", \"for\": {\"hours\": 0, \"minutes\": 0, \"seconds\": 30}}]"
  action      = "[{\"service\": \"light.turn_off\", \"data\": {}, \"target\": {\"entity_id\": \"light.sonoff_100110aad7\"}}]"
}

resource "homeassistant_automation" "light_hol_turn_off" {
  alias       = "Light-Hol-turn-off"
  mode        = "single"
  trigger     = "[{\"type\": \"no_motion\", \"platform\": \"device\", \"device_id\": \"9760dbf983194fdd33aea4553da75f35\", \"entity_id\": \"0ba7443acab61b6da15910aa07d009c1\", \"domain\": \"binary_sensor\", \"for\": {\"hours\": 0, \"minutes\": 30, \"seconds\": 0}}]"
  condition   = "[{\"condition\": \"or\", \"conditions\": [{\"condition\": \"state\", \"entity_id\": \"switch.100110a66f\", \"state\": \"on\", \"for\": {\"hours\": 0, \"minutes\": 0, \"seconds\": 0}}, {\"condition\": \"state\", \"entity_id\": \"switch.1000f87bf9\", \"state\": \"on\", \"for\": {\"hours\": 0, \"minutes\": 0, \"seconds\": 0}}, {\"condition\": \"state\", \"entity_id\": \"switch.1000f87f30\", \"state\": \"on\", \"for\": {\"hours\": 0, \"minutes\": 0, \"seconds\": 0}}]}]"
  action      = "[{\"service\": \"light.turn_off\", \"data\": {}, \"target\": {\"entity_id\": [\"light.sonoff_100110a66f\", \"light.sonoff_1000f87f30\", \"light.sonoff_1000f87bf9\"]}}]"
}

resource "homeassistant_automation" "light_kuhnia_off_test" {
  alias       = "Light - Kuhnia - motion - off"
  mode        = "single"
  trigger     = "[{\"type\": \"no_motion\", \"platform\": \"device\", \"device_id\": \"e1a4619eb832bc72aaa9ba54982ec09e\", \"entity_id\": \"5ae64a275a01082244c6aa70d5c94c3a\", \"domain\": \"binary_sensor\", \"for\": {\"hours\": 0, \"minutes\": 1, \"seconds\": 5}}]"
  action      = "[{\"service\": \"light.turn_off\", \"data\": {}, \"target\": {\"entity_id\": [\"light.sonoff_100110b38f\", \"light.sonoff_1000f8892e\"]}}]"
}

resource "homeassistant_automation" "light_kuhnia_on_test" {
  alias       = "Light - Kuhnia - motion - on "
  mode        = "single"
  trigger     = "[{\"type\": \"motion\", \"platform\": \"device\", \"device_id\": \"e1a4619eb832bc72aaa9ba54982ec09e\", \"entity_id\": \"5ae64a275a01082244c6aa70d5c94c3a\", \"domain\": \"binary_sensor\"}]"
  action      = "[{\"service\": \"light.turn_on\", \"data\": {}, \"target\": {\"entity_id\": [\"light.sonoff_1000f8892e\", \"light.sonoff_100110b38f\"]}}]"
}

resource "homeassistant_automation" "light_spalniag_turn_all_on_when_single_turned_on" {
  alias       = "Light - BedroomB - turn all on - when Single turned on"
  mode        = "single"
  trigger     = "[{\"platform\": \"device\", \"type\": \"turned_on\", \"device_id\": \"7faca27b2e7b53e7e6b6f3ee362edd2a\", \"entity_id\": \"8e21d909e74c194d5c332619801d4276\", \"domain\": \"light\"}, {\"platform\": \"device\", \"type\": \"turned_on\", \"device_id\": \"bcaf6c3359354e3c7180adaf2c49a1ad\", \"entity_id\": \"7bab5241a752c36a1e487e6a9a751945\", \"domain\": \"light\"}, {\"platform\": \"device\", \"type\": \"turned_on\", \"device_id\": \"cc3f34bd6934d548cf6309c9766fb553\", \"entity_id\": \"221c5be78faf74cec47dfbf7b8654cf2\", \"domain\": \"switch\"}, {\"platform\": \"device\", \"type\": \"turned_on\", \"device_id\": \"98eff86a73c04c2e599af0bbf9d538f9\", \"entity_id\": \"2fd4c1d4930c73041ee22aaf92e483dd\", \"domain\": \"switch\"}]"
  action      = "[{\"type\": \"turn_on\", \"device_id\": \"7faca27b2e7b53e7e6b6f3ee362edd2a\", \"entity_id\": \"8e21d909e74c194d5c332619801d4276\", \"domain\": \"light\"}, {\"type\": \"turn_on\", \"device_id\": \"cc3f34bd6934d548cf6309c9766fb553\", \"entity_id\": \"b59881afb79ac5a3569eeae3605ce86f\", \"domain\": \"light\"}, {\"type\": \"turn_on\", \"device_id\": \"98eff86a73c04c2e599af0bbf9d538f9\", \"entity_id\": \"b0f578f522c125bd3ae120f484ee3e66\", \"domain\": \"light\"}, {\"type\": \"turn_on\", \"device_id\": \"bcaf6c3359354e3c7180adaf2c49a1ad\", \"entity_id\": \"7bab5241a752c36a1e487e6a9a751945\", \"domain\": \"light\"}]"
}

resource "homeassistant_automation" "light_toilet_off" {
  alias       = "Light - toilet - OFF"
  mode        = "single"
  trigger     = "[{\"type\": \"no_motion\", \"platform\": \"device\", \"device_id\": \"f15b2083435bc9a67fca9f2a85ffd508\", \"entity_id\": \"e79f74883dd79650829a2585976153d2\", \"domain\": \"binary_sensor\", \"for\": {\"hours\": 0, \"minutes\": 2, \"seconds\": 0}}]"
  action      = "[{\"service\": \"light.turn_off\", \"data\": {}, \"target\": {\"entity_id\": \"light.sonoff_10013c2bc6\"}}]"
}

resource "homeassistant_automation" "light_toilet_on" {
  alias       = "Light - toilet - ON"
  mode        = "single"
  trigger     = "[{\"type\": \"motion\", \"platform\": \"device\", \"device_id\": \"f15b2083435bc9a67fca9f2a85ffd508\", \"entity_id\": \"e79f74883dd79650829a2585976153d2\", \"domain\": \"binary_sensor\"}]"
  action      = "[{\"service\": \"light.turn_on\", \"data\": {}, \"target\": {\"entity_id\": \"light.sonoff_10013c2bc6\"}}]"
}

resource "homeassistant_automation" "livingr_aircon_flap_swing_door_sensor" {
  alias       = "Aircon - LivingR - flap swing door sensor"
  mode        = "single"
  trigger     = "[{\"type\": \"opened\", \"platform\": \"device\", \"device_id\": \"ed25d6b3e2ff263dd479414791ddc55b\", \"entity_id\": \"fed6a7811fa98c9db10c61b0bc656a7f\", \"domain\": \"binary_sensor\"}]"
  action      = "[{\"if\": [{\"condition\": \"state\", \"entity_id\": \"climate.hol\", \"attribute\": \"swing_mode\", \"state\": \"4\"}], \"then\": [{\"service\": \"climate.set_swing_mode\", \"target\": {\"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\"}, \"data\": {\"swing_mode\": \"5_down\"}}], \"else\": [{\"service\": \"climate.set_swing_mode\", \"target\": {\"device_id\": \"44cfd8c25ff5c476fd5c6a5124d66470\"}, \"data\": {\"swing_mode\": \"4\"}}]}]"
}

resource "homeassistant_automation" "spalniag_turn_all_off_when_single_turned_off" {
  alias       = "Light - BedroomB - turn all off - when single turned off"
  mode        = "single"
  trigger     = "[{\"platform\": \"device\", \"type\": \"turned_off\", \"device_id\": \"7faca27b2e7b53e7e6b6f3ee362edd2a\", \"entity_id\": \"8e21d909e74c194d5c332619801d4276\", \"domain\": \"light\"}, {\"platform\": \"device\", \"type\": \"turned_off\", \"device_id\": \"bcaf6c3359354e3c7180adaf2c49a1ad\", \"entity_id\": \"7bab5241a752c36a1e487e6a9a751945\", \"domain\": \"light\"}, {\"platform\": \"device\", \"type\": \"turned_off\", \"device_id\": \"cc3f34bd6934d548cf6309c9766fb553\", \"entity_id\": \"b59881afb79ac5a3569eeae3605ce86f\", \"domain\": \"light\"}, {\"platform\": \"device\", \"type\": \"turned_off\", \"device_id\": \"98eff86a73c04c2e599af0bbf9d538f9\", \"entity_id\": \"b0f578f522c125bd3ae120f484ee3e66\", \"domain\": \"light\"}]"
  action      = "[{\"type\": \"turn_off\", \"device_id\": \"7faca27b2e7b53e7e6b6f3ee362edd2a\", \"entity_id\": \"8e21d909e74c194d5c332619801d4276\", \"domain\": \"light\"}, {\"type\": \"turn_off\", \"device_id\": \"cc3f34bd6934d548cf6309c9766fb553\", \"entity_id\": \"b59881afb79ac5a3569eeae3605ce86f\", \"domain\": \"light\"}, {\"type\": \"turn_off\", \"device_id\": \"98eff86a73c04c2e599af0bbf9d538f9\", \"entity_id\": \"b0f578f522c125bd3ae120f484ee3e66\", \"domain\": \"light\"}, {\"type\": \"turn_off\", \"device_id\": \"bcaf6c3359354e3c7180adaf2c49a1ad\", \"entity_id\": \"7bab5241a752c36a1e487e6a9a751945\", \"domain\": \"light\"}]"
}

resource "homeassistant_automation" "spalniam" {
  alias       = "AirCon - morning - BedroomS - summer"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"09:00:00\"}]"
  condition   = "[{\"condition\": \"template\", \"value_template\": \"{{ now().month >= 5 and now().month <= 10 }}\"}, {\"condition\": \"device\", \"device_id\": \"fc904b6e699a030a09e6abd829c8717f\", \"domain\": \"climate\", \"entity_id\": \"climate.v537_spalniam\", \"type\": \"is_hvac_mode\", \"hvac_mode\": \"cool\"}]"
  action      = "[{\"service\": \"climate.set_temperature\", \"data\": {\"temperature\": 25.5, \"hvac_mode\": \"cool\"}, \"target\": {\"entity_id\": \"climate.v537_spalniam\"}}]"
}

resource "homeassistant_automation" "tag_away" {
  alias       = "Tag Away"
  mode        = "single"
  trigger     = "[{\"platform\": \"tag\", \"tag_id\": \"7a261e47-1623-4cd2-9409-8aa854b61bb8\"}]"
  action      = "[{\"service\": \"scene.turn_on\", \"target\": {\"entity_id\": \"scene.antre_all_off\"}, \"metadata\": {}}, {\"service\": \"scene.turn_on\", \"target\": {\"entity_id\": \"scene.bedroomb_all_off\"}, \"metadata\": {}}, {\"service\": \"scene.turn_on\", \"target\": {\"entity_id\": \"scene.bedrooms_all_off\"}, \"metadata\": {}}, {\"service\": \"scene.turn_on\", \"target\": {\"entity_id\": \"scene.living_all_off\"}, \"metadata\": {}}, {\"service\": \"scene.turn_on\", \"target\": {\"entity_id\": \"scene.kitchen_all_off\"}, \"metadata\": {}}]"
}

resource "homeassistant_automation" "tag_home_is_scanned" {
  alias       = "Tag Home"
  mode        = "single"
  trigger     = "[{\"platform\": \"tag\", \"tag_id\": \"9bdf58d0-05ab-4537-b348-991c21b99f57\"}]"
  action      = "[{\"service\": \"scene.turn_on\", \"target\": {\"entity_id\": \"scene.antre_all\"}, \"metadata\": {}}, {\"service\": \"scene.turn_on\", \"target\": {\"entity_id\": \"scene.kitchen_all\"}, \"metadata\": {}}]"
}

resource "homeassistant_automation" "vacuum_at_19h_all_away" {
  alias       = "Vacuum at 19h all away"
  mode        = "single"
  trigger     = "[{\"platform\": \"time\", \"at\": \"19:05:00\"}]"
  condition   = "[{\"condition\": \"device\", \"device_id\": \"6c73c88c22f0e954d7c9395fbabffdc1\", \"domain\": \"device_tracker\", \"entity_id\": \"device_tracker.fold_4\", \"type\": \"is_not_home\"}, {\"condition\": \"device\", \"device_id\": \"72b011baafff5f5910257fe7b8edcdce\", \"domain\": \"device_tracker\", \"entity_id\": \"4596683387e3ffad9f6f3a64f810cba5\", \"type\": \"is_not_home\"}]"
  action      = "[{\"condition\": \"and\", \"conditions\": [{\"condition\": \"template\", \"value_template\": \"{{ not is_state('sensor.iphone_bssid', '9c:9d:7e:75:21:a1') and not is_state('sensor.iphone_bssid', '9c:9d:7e:75:21:a0') }}\"}, {\"condition\": \"template\", \"value_template\": \"{{ not is_state('sensor.fold_4_wifi_bssid', '9c:9d:7e:75:21:a1') and not is_state('sensor.fold_4_wifi_bssid', '9c:9d:7e:75:21:a0') }}\"}]}, {\"device_id\": \"e298a8b40242a34b564f605dd4bef055\", \"domain\": \"vacuum\", \"entity_id\": \"640b3c68636c87bce9cf9b056fc77a2d\", \"type\": \"clean\"}]"
}

resource "homeassistant_automation" "vacuum_when_all_are_away" {
  alias       = "Vacuum when all are away"
  mode        = "single"
  trigger     = "[{\"platform\": \"device\", \"device_id\": \"6c73c88c22f0e954d7c9395fbabffdc1\", \"domain\": \"device_tracker\", \"entity_id\": \"device_tracker.fold_4\", \"type\": \"leaves\", \"zone\": \"zone.home_2\"}, {\"platform\": \"device\", \"device_id\": \"72b011baafff5f5910257fe7b8edcdce\", \"domain\": \"device_tracker\", \"entity_id\": \"4596683387e3ffad9f6f3a64f810cba5\", \"type\": \"leaves\", \"zone\": \"zone.home_2\"}]"
  condition   = "[{\"condition\": \"and\", \"conditions\": [{\"condition\": \"device\", \"device_id\": \"6c73c88c22f0e954d7c9395fbabffdc1\", \"domain\": \"device_tracker\", \"entity_id\": \"device_tracker.fold_4\", \"type\": \"is_not_home\"}, {\"condition\": \"device\", \"device_id\": \"cc4db4786cca0d84a1f75d2f4badf03b\", \"domain\": \"device_tracker\", \"entity_id\": \"device_tracker.xiaomi_12s_ultra\", \"type\": \"is_not_home\"}]}, {\"condition\": \"and\", \"conditions\": []}]"
  action      = "[{\"delay\": {\"hours\": 0, \"minutes\": 15, \"seconds\": 0, \"milliseconds\": 0}}, {\"condition\": \"and\", \"conditions\": [{\"condition\": \"template\", \"value_template\": \"{{ not is_state('sensor.iphone_bssid', '9c:9d:7e:75:21:a1') and not is_state('sensor.iphone_bssid', '9c:9d:7e:75:21:a0') }}\"}, {\"condition\": \"template\", \"value_template\": \"{{ not is_state('sensor.fold_4_wifi_bssid', '9c:9d:7e:75:21:a1') and not is_state('sensor.fold_4_wifi_bssid', '9c:9d:7e:75:21:a0') }}\"}]}, {\"device_id\": \"e298a8b40242a34b564f605dd4bef055\", \"domain\": \"vacuum\", \"entity_id\": \"640b3c68636c87bce9cf9b056fc77a2d\", \"type\": \"clean\"}]"
}

locals {
  livingr_climate_test_setup = <<EOT
{% set room = states('sensor.miaomiaoce_t2_1228_temperature_humidity_sensor') | float(none) %}
{% set battery = states('sensor.miaomiaoce_t2_1228_battery_level') | float(0) %}
{% set ac_temp = state_attr('climate.hol_2', 'current_temperature') | float(none) %}
{% set outside_venti_raw = states('sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor') | float(none) %}
{% set outside_venti_battery = states('sensor.miaomiaoce_t2_56fa_battery_level') | float(0) %}
{% set outside_weather = state_attr('weather.forecast_home', 'temperature') | float(none) %}
{% set outside_venti_device = states('sensor.venti_outside_temperature') | float(none) %}
{% if outside_venti_battery > 10 and outside_venti_raw is not none %}
  {% set outside_source = 'venti_in_adjusted' %}
  {% set outside = outside_venti_raw - 2 %}
{% elif outside_weather is not none %}
  {% set outside_source = 'weather_forecast_home' %}
  {% set outside = outside_weather %}
{% elif outside_venti_device is not none %}
  {% set outside_source = 'venti_device_outside' %}
  {% set outside = outside_venti_device %}
{% else %}
  {% set outside_source = 'none' %}
  {% set outside = none %}
{% endif %}
{% set climate_mode = 'winter' if outside is not none and outside <= 8 else 'summer' if outside is not none and outside >= 15 else 'neutral' %}
{% set source = 'room_sensor' if battery > 10 and room is not none else 'climate_fallback' %}
{% set effective = room if source == 'room_sensor' else ac_temp %}
{% set target = 24.2 if climate_mode == 'summer' and outside is not none and outside < 28 else 24.0 if climate_mode == 'summer' else 22 if climate_mode == 'winter' else none %}
{% set learned_overshoot = [0, [1, states('input_number.livingr_cooling_overshoot') | float(0.2)] | min] | max %}
{% set cooling_stop_room_temp = states('input_number.livingr_cooling_stop_room_temp') | float(0) %}
{% set error = effective - target if effective is not none and target is not none else none %}
{% set dynamic_setpoint = ([16, [31, ((ac_temp - error) * 2) | round(0) / 2] | min] | max) if ac_temp is not none and error is not none else none %}
{% set minutes_now = now().hour * 60 + now().minute %}
{% set night_sleep_window = minutes_now >= 30 and minutes_now < 510 %}
{% set night_air_clean_window = minutes_now >= 180 and minutes_now < 360 %}
{% set night_window = night_air_clean_window %}
{% set day_air_clean_window = now().hour >= 8 and now().hour <= 23 %}
EOT

  livingr_climate_test_log_suffix = "mode={{ climate_mode }}, night_sleep={{ night_sleep_window }}, night_air_clean={{ night_air_clean_window }}, outside_source={{ outside_source }}, outside={{ outside }}, venti_raw={{ outside_venti_raw }}, venti_battery={{ outside_venti_battery }}%, weather={{ outside_weather }}, source={{ source }}, room={{ room }}, room_battery={{ battery }}%, ac_sensor={{ ac_temp }}, target={{ target }}, learned_overshoot={{ learned_overshoot }}, stop_room={{ cooling_stop_room_temp }}, error={{ error | round(2) if error is not none else 'none' }}, setpoint={{ dynamic_setpoint }}"
}

resource "homeassistant_automation" "test_aircon_livingr_room_sensor_comfort_band" {
  alias       = "[TEST] AirCon - LivingR - room sensor comfort band"
  description = "Test automation for LivingR climate.hol_2. Uses Living tv 1 temperature sensor while its battery is above 10%; falls back to climate current_temperature when the room sensor battery is at or below 10%. Climate mode is based on an outside temperature fallback chain: Venti In 7 with -2C offset when its battery is above 10%, then weather.forecast_home temperature, then sensor.venti_outside_temperature. Winter when outside <= 8C, summer when outside >= 15C, neutral when outside is > 8C and < 15C. Dynamic setpoint = climate_sensor_temperature - (effective_room_temperature - target). Summer target is 24.2C on mild summer days below 28C outside, otherwise 24.0C; winter target is 22C. Summer cooling starts above target + 0.2C and moves to fan_only + fan 2 at target + learned overshoot for a 7 minute coil cool-down/dry-out period before turning off. The learned overshoot is stored in input_number.livingr_cooling_overshoot and updated from each cool-down cycle using 70/30 smoothing. Night sleep window 00:30-08:30 blocks comfort cooling/heating and keeps the climate off, except the 03:00-06:00 air-clean window which uses fan_only + fan 5 in both seasons. During daytime, no LivingR motion for 15m raises fan to 5 only while the climate is already in fan_only; motion restores fan 3 in fan_only. Uses climate.set_hvac_mode: off because this MELCloud climate entity does not support climate.turn_off."
  mode        = "single"

  trigger = jsonencode([
    {
      platform = "time_pattern"
      minutes  = "/5"
      id       = "periodic_check"
    },
    {
      platform = "time"
      at       = "00:30:00"
      id       = "night_sleep_start"
    },
    {
      platform = "time"
      at       = "03:00:00"
      id       = "night_air_clean_start"
    },
    {
      platform = "time"
      at       = "06:00:00"
      id       = "night_air_clean_end"
    },
    {
      platform = "time"
      at       = "08:30:00"
      id       = "night_sleep_end"
    },
    {
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_1228_temperature_humidity_sensor"
      "for" = {
        minutes = 3
      }
      id = "room_temperature_stable_change"
    },
    {
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_1228_battery_level"
      id        = "room_sensor_battery_changed"
    },
    {
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_56fa_temperature_humidity_sensor"
      "for" = {
        minutes = 10
      }
      id = "outside_proxy_temperature_stable_change"
    },
    {
      platform  = "state"
      entity_id = "sensor.miaomiaoce_t2_56fa_battery_level"
      id        = "outside_proxy_battery_changed"
    },
    {
      platform  = "state"
      entity_id = "weather.forecast_home"
      id        = "weather_changed"
    },
    {
      platform  = "state"
      entity_id = "sensor.venti_outside_temperature"
      id        = "venti_device_outside_changed"
    },
    {
      platform  = "state"
      entity_id = "binary_sensor.motion01"
      from      = "on"
      to        = "off"
      "for" = {
        minutes = 15
      }
      id = "livingr_no_motion_15m"
    },
    {
      platform  = "state"
      entity_id = "binary_sensor.motion01"
      from      = "off"
      to        = "on"
      id        = "livingr_motion"
    }
  ])

  condition = jsonencode([
    {
      condition      = "template"
      value_template = "{{ states('climate.hol_2') not in ['unknown', 'unavailable'] }}"
    },
    {
      condition      = "template"
      value_template = "{{ state_attr('climate.hol_2', 'current_temperature') is not none }}"
    },
    {
      condition      = "template"
      value_template = "${local.livingr_climate_test_setup}\n{{ outside is not none }}"
    }
  ])

  action = jsonencode([
    {
      choose = [
        {
          alias = "Night: air cleaning fan only at max speed"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ night_air_clean_window and (states('climate.hol_2') != 'fan_only' or (state_attr('climate.hol_2', 'fan_mode') or '') != '5') }}"
            }
          ]
          sequence = [
            {
              service = "climate.set_hvac_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                hvac_mode = "fan_only"
              }
            },
            {
              service = "climate.set_temperature"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                temperature = 30
              }
            },
            {
              service = "climate.set_fan_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                fan_mode = "5"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nNight air cleaning: fan_only fan 5; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        },
        {
          alias = "Night: sleep keeps climate off outside air-clean window"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ night_sleep_window and not night_air_clean_window and states('climate.hol_2') != 'off' }}"
            }
          ]
          sequence = [
            {
              service = "climate.set_hvac_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                hvac_mode = "off"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nNight sleep: climate off outside 03:00-06:00 air-clean window; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        },
        {
          alias = "Daytime no motion: raise fan while climate is already running"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ not night_sleep_window and day_air_clean_window and is_state('binary_sensor.motion01', 'off') and states('climate.hol_2') == 'fan_only' and (state_attr('climate.hol_2', 'fan_mode') or '') not in ['2', '5'] }}"
            }
          ]
          sequence = [
            {
              service = "climate.set_fan_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                fan_mode = "5"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nDaytime no motion: fan 5 air cleaning while climate already running; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        },
        {
          alias = "Daytime motion: restore fan 3 while climate is already running"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ not night_sleep_window and day_air_clean_window and is_state('binary_sensor.motion01', 'on') and states('climate.hol_2') == 'fan_only' and (state_attr('climate.hol_2', 'fan_mode') or '') not in ['2', '3'] }}"
            }
          ]
          sequence = [
            {
              service = "climate.set_fan_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                fan_mode = "3"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nDaytime motion: restoring fan 3 while climate already running; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        },
        {
          alias = "Summer: cool when room is above target comfort band and outside mode is summer"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ not night_sleep_window and climate_mode == 'summer' and effective is not none and target is not none and effective > target + 0.2 and dynamic_setpoint is not none }}"
            },
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ states('climate.hol_2') != 'cool' or (state_attr('climate.hol_2', 'temperature') | float(0)) != (dynamic_setpoint | float) }}"
            }
          ]
          sequence = [
            {
              service = "climate.set_hvac_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                hvac_mode = "cool"
              }
            },
            {
              service = "climate.set_temperature"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                temperature = "${local.livingr_climate_test_setup}\n{{ dynamic_setpoint }}"
              }
            },
            {
              service = "climate.set_fan_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                fan_mode = "2"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nSummer cooling with mild-day target, narrower comfort band and dynamic climate setpoint; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        },
        {
          alias = "Summer: coil cool-down after target is reached or outside mode is no longer summer"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ states('climate.hol_2') == 'cool' and (climate_mode != 'summer' or (effective is not none and target is not none and effective <= target + learned_overshoot)) }}"
            }
          ]
          sequence = [
            {
              service = "input_number.set_value"
              target = {
                entity_id = "input_number.livingr_cooling_stop_room_temp"
              }
              data = {
                value = "${local.livingr_climate_test_setup}\n{{ effective | round(1) if effective is not none else 0 }}"
              }
            },
            {
              service = "climate.set_hvac_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                hvac_mode = "fan_only"
              }
            },
            {
              service = "climate.set_fan_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                fan_mode = "2"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nSummer cooling reached learned stop band: saved stop_room and started fan_only fan 2 coil cool-down; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        },
        {
          alias = "Summer: turn off after coil cool-down"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ not night_air_clean_window and states('climate.hol_2') == 'fan_only' and (state_attr('climate.hol_2', 'fan_mode') or '') == '2' and (as_timestamp(now()) - as_timestamp(states.climate.hol_2.last_changed)) >= 420 }}"
            }
          ]
          sequence = [
            {
              service = "input_number.set_value"
              target = {
                entity_id = "input_number.livingr_cooling_overshoot"
              }
              data = {
                value = "${local.livingr_climate_test_setup}\n{% set measured = [0, cooling_stop_room_temp - effective] | max if effective is not none and cooling_stop_room_temp > 0 else learned_overshoot %}\n{{ ([0, [1, (learned_overshoot * 0.7 + measured * 0.3)] | min] | max) | round(1) }}"
              }
            },
            {
              service = "input_number.set_value"
              target = {
                entity_id = "input_number.livingr_cooling_stop_room_temp"
              }
              data = {
                value = 0
              }
            },
            {
              service = "climate.set_hvac_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                hvac_mode = "off"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nSummer coil cool-down complete after 7 minutes: learned overshoot updated and climate off; measured_overshoot={{ [0, cooling_stop_room_temp - effective] | max if effective is not none and cooling_stop_room_temp > 0 else 'none' }}; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        },
        {
          alias = "Winter: heat when room is below 21.5C and outside mode is winter"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ not night_sleep_window and climate_mode == 'winter' and effective is not none and effective < 21.5 and dynamic_setpoint is not none }}"
            },
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ states('climate.hol_2') != 'heat' or (state_attr('climate.hol_2', 'temperature') | float(0)) != (dynamic_setpoint | float) }}"
            }
          ]
          sequence = [
            {
              service = "climate.set_hvac_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                hvac_mode = "heat"
              }
            },
            {
              service = "climate.set_temperature"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                temperature = "${local.livingr_climate_test_setup}\n{{ dynamic_setpoint }}"
              }
            },
            {
              service = "climate.set_fan_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                fan_mode = "3"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nWinter heating with outside fallback chain and dynamic climate setpoint; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        },
        {
          alias = "Winter: turn off after target is reached or outside mode is no longer winter"
          conditions = [
            {
              condition      = "template"
              value_template = "${local.livingr_climate_test_setup}\n{{ states('climate.hol_2') == 'heat' and (climate_mode != 'winter' or (effective is not none and effective >= 22.0)) }}"
            }
          ]
          sequence = [
            {
              service = "climate.set_hvac_mode"
              target = {
                entity_id = "climate.hol_2"
              }
              data = {
                hvac_mode = "off"
              }
            },
            {
              service = "logbook.log"
              data = {
                name      = "[TEST] LivingR climate comfort band"
                message   = "${local.livingr_climate_test_setup}\nWinter heating stopped: target reached or outside mode changed; ${local.livingr_climate_test_log_suffix}"
                entity_id = "climate.hol_2"
              }
            }
          ]
        }
      ]
    }
  ])
}
