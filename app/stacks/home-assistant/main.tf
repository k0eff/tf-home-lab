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
