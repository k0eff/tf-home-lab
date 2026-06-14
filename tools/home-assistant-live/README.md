# Home Assistant Live Scripts

Това е canonical директорията за live Home Assistant/Hass.io helper скриптовете.

Правило:

- ако скрипт се ползва за live inspect, verify, patch или migration, той трябва да съществува тук
- `/private/tmp` може да се ползва само като временен runtime терен, но не и като единствено място, където живее логиката

## Как се пускат

Подготви средата:

```bash
source protected/main.sh prod home-assistant >/dev/null
```

Пусни конкретен script:

```bash
HA_BASE=${HA_URL%/} /Users/krasi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tools/home-assistant-live/<script>.js
```

Всички `.js` скриптове тук:

- нямат subcommands
- нямат CLI flags
- нямат позиционни аргументи
- ползват вътрешни константи, entity ids, automation ids и view paths

Изключения:

- `ha_ws_util.js` не е executable script, а shared helper module

## Зависимости

- `protected/main.sh`
  - зарежда `HA_URL`, `HA_TOKEN`, `TS_ENV`, `TS_STACK`
- `HA_BASE=${HA_URL%/}`
  - подава clean base URL към helper-ите
- `ha_ws_util.js`
  - общ websocket/REST helper за Home Assistant API

## Файлове

### Core helper

- `ha_ws_util.js`
  - shared low-level helper за Home Assistant websocket и REST API
  - exports:
    - `connectWs()`
    - `rest(path, method, payload)`
  - subcommands: няма
  - options: няма

### Apply / Patch scripts

- `add_bedroomb_tf_block.js`
  - добавя/генерира Terraform блок за BedroomB свързан с live HA workflow
  - writes: да
  - subcommands: няма
  - options: няма
- `add_time_helpers_to_tf.js`
  - добавя time helper дефиниции към Terraform/source workflow
  - writes: да
  - subcommands: няма
  - options: няма
- `fix_dashboard_helper_ids.js`
  - пренасочва dashboard и automation reference-и към правилните helper entity ids
  - writes: да
  - subcommands: няма
  - options: няма
- `fix_live_template_stray_brace.js`
  - маха stray template символ/brace в live automation config
  - writes: да
  - subcommands: няма
  - options: няма
- `fix_thresholds_and_dashboard_controls.js`
  - коригира threshold логика и dashboard controls в live HA
  - writes: да
  - subcommands: няма
  - options: няма
- `install_manual_override.js`
  - създава/обновява manual override helper-и, patch-ва automation-и и dashboard карти
  - writes: да
  - subcommands: няма
  - options: няма
- `normalize_temperature_units.js`
  - сменя helper unit-ите от `temperature` на `°C`
  - writes: да
  - subcommands: няма
  - options: няма
- `patch_livingr_live_conditions.js`
  - patch-ва LivingR live automation condition логика
  - writes: да
  - subcommands: няма
  - options: няма
- `reorder_bedb_like_living.js`
  - пренарежда `bedb` dashboard view да следва `living`
  - writes: да
  - subcommands: няма
  - options: няма
- `rework_climate_dashboards.js`
  - по-голям dashboard rework за climate views
  - writes: да
  - subcommands: няма
  - options: няма
- `rework_scenario_targets.js`
  - преработва scenario target helper-и и dashboard presentation
  - writes: да
  - subcommands: няма
  - options: няма
- `setup_bedroomb_comfort.js`
  - initial/iterative setup на BedroomB comfort automation и helper-и
  - writes: да
  - subcommands: няма
  - options: няма
- `setup_delayed_program_toggles.js`
  - създава delayed program toggle helper flow за room program on/off
  - writes: да
  - subcommands: няма
  - options: няма
- `setup_presence.js`
  - създава fused presence helper-и, patch-ва presence automation и добавя status/diagnostics карти в `my-dash`
  - writes: да
  - subcommands: няма
  - options: няма
- `sync_room_energy_tables.js`
  - генерира дневни kWh markdown таблици за LivingR и BedroomB от history API и ги patch-ва в room dashboard-ите
  - writes: да
  - subcommands: няма
  - options: няма
- `update_livingr_energy_table.js`
  - обновява energy table съдържание за LivingR
  - writes: да
  - subcommands: няма
  - options: няма

### Verify scripts

- `check_helper_configs.js`
  - проверява дали expected helper ids съществуват в HA helper config
  - writes: не
  - subcommands: няма
  - options: няма
- `check_missing_dashboard_entities.js`
  - сравнява entity ids в dashboard-а срещу live state списъка
  - writes: не
  - subcommands: няма
  - options: няма
- `list_matching_helpers.js`
  - listing на helper-и по pattern за `livingr`, `bedroomb`, `manual`, `night`
  - writes: не
  - subcommands: няма
  - options: няма
- `list_temperature_unit_helpers.js`
  - показва unit metadata на room helper-ите
  - writes: не
  - subcommands: няма
  - options: няма
- `sample_helper_lists.js`
  - кратка справка за наличните helper списъци по domain
  - writes: не
  - subcommands: няма
  - options: няма
- `show_dash_order.js`
  - показва реда на картите в `living` и `bedb`
  - writes: не
  - subcommands: няма
  - options: няма
- `verify_bedroomb_comfort.js`
  - verify на BedroomB comfort automation/state assumptions
  - writes: не
  - subcommands: няма
  - options: няма
- `verify_bedroomb_night_comfort.js`
  - verify на BedroomB night comfort логика
  - writes: не
  - subcommands: няма
  - options: няма
- `verify_climate_dashboard_rework.js`
  - verify на dashboard rework резултатите
  - writes: не
  - subcommands: няма
  - options: няма
- `verify_climate_panels.js`
  - verify на panel presence, automation references и dashboard consistency
  - writes: не
  - subcommands: няма
  - options: няма
- `verify_manual_override.js`
  - verify на manual override helper-и, automation-и и dashboard карти
  - writes: не
  - subcommands: няма
  - options: няма

### Investigate / Inspect scripts

- `ha_find_bedroomb_entities.js`
  - намира BedroomB entity ids в live HA
  - writes: не
  - subcommands: няма
  - options: няма
- `ha_inspect_bedroomb.js`
  - инспектира BedroomB state/config контекст
  - writes: не
  - subcommands: няма
  - options: няма
- `investigate_bedroomb_day_mode.js`
  - диагностичен скрипт за BedroomB дневен режим
  - writes: не
  - subcommands: няма
  - options: няма
- `investigate_bedroomb_sensors.js`
  - диагностичен скрипт за BedroomB sensor selection/health
  - writes: не
  - subcommands: няма
  - options: няма
- `investigate_livingr_accidental_off.js`
  - разследва кога и защо LivingR е бил изключен
  - writes: не
  - subcommands: няма
  - options: няма
- `livingr_recent_history.js`
  - чете recent historical/context данни за LivingR
  - writes: не
  - subcommands: няма
  - options: няма
- `read_climate_capabilities.js`
  - чете live climate capabilities като `hvac_modes`, `fan_modes`, `swing_modes`
  - writes: не
  - subcommands: няма
  - options: няма

### Generated artifacts

- `livingr_energy_table.md`
  - generated markdown table за LivingR energy history/reference
  - executable: не
- `livingr_energy_table_pinned.md`
  - pinned comparison rows за LivingR energy view
  - executable: не
- `bedroomb_energy_table.md`
  - generated markdown table за BedroomB energy history/reference
  - executable: не

## Кога добавяме нов script

Добавяй нов файл тук когато:

- правим live HA patch, който може да потрябва пак
- има verify/check logic, която искаме да е повторима
- има investigation flow, който не трябва да остане само в chat history

Не оставяй единственото копие на работещ logic в `/private/tmp`.

## Кога script може да остане само временен

Само ако е чист експеримент и е сигурно, че:

- няма да се ползва втори път
- не участва в documented workflow
- не е нужен за audit/debug later

При съмнение:

- добавяй го тук
