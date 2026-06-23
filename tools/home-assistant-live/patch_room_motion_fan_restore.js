const { rest } = require("./ha_ws_util");

const rooms = [
  {
    key: "livingr",
    automationId: "1770077000010",
    climate: "climate.hol_2",
    motion: "binary_sensor.motion01",
    fanMessage: "Daytime motion: restoring occupied fan profile while climate already running;",
  },
  {
    key: "bedroomb",
    automationId: "1770077000021",
    climate: "climate.v357_spalniag_2",
    motion: "binary_sensor.motion03",
    fanMessage: "Daytime motion: restoring occupied fan profile while climate already running;",
  },
];

function patchMotionBranch(branch, room) {
  const climate = room.climate;
  const motion = room.motion;
  branch.conditions[0].value_template = branch.conditions[0].value_template.replace(
    `{{ not night_sleep_window and day_air_clean_window and is_state('${motion}', 'on') and states('${climate}') == 'fan_only' and (state_attr('${climate}', 'fan_mode') or '') not in ['2', '3'] }}`,
    `{{ not night_sleep_window and day_air_clean_window and is_state('${motion}', 'on') and ((states('${climate}') == 'fan_only' and (state_attr('${climate}', 'fan_mode') or '') not in ['2', '3']) or (states('${climate}') == 'cool' and (state_attr('${climate}', 'fan_mode') or '') != (cooling_fan_mode | string))) }}`,
  );

  branch.sequence = [
    {
      choose: [
        {
          alias: "Motion while cooling: restore configured cooling fan",
          conditions: [
            {
              condition: "template",
              value_template: `{{ states('${climate}') == 'cool' }}`,
            },
          ],
          sequence: [
            {
              service: "climate.set_fan_mode",
              target: { entity_id: climate },
              data: {
                fan_mode: `{{ states('input_number.${room.key}_cooling_fan_mode') | int(2) }}`,
              },
            },
          ],
        },
      ],
      default: [
        {
          service: "climate.set_fan_mode",
          target: { entity_id: climate },
          data: { fan_mode: "3" },
        },
      ],
    },
    branch.sequence[1],
  ];

  branch.sequence[1].data.message = branch.sequence[1].data.message.replace(
    "Daytime motion: restoring fan 3 while climate already running;",
    room.fanMessage,
  );
}

function patchSummerCoolingBranch(branch) {
  const fanIndex = branch.sequence.findIndex((step) => step.service === "climate.set_fan_mode");
  const tempIndex = branch.sequence.findIndex((step) => step.service === "climate.set_temperature");
  if (fanIndex !== -1 && tempIndex !== -1 && tempIndex < fanIndex) {
    const [tempStep] = branch.sequence.splice(tempIndex, 1);
    const newFanIndex = branch.sequence.findIndex((step) => step.service === "climate.set_fan_mode");
    branch.sequence.splice(newFanIndex + 1, 0, tempStep);
  }
}

function patchConfig(config, room) {
  const choose = config.action?.[0]?.choose || [];
  for (const branch of choose) {
    if (branch.alias === "Daytime motion: restore fan 3 while climate is already running") {
      patchMotionBranch(branch, room);
    }
    if (branch.alias === "Summer: cool when room is above target comfort band and outside mode is summer") {
      patchSummerCoolingBranch(branch);
    }
  }
  return config;
}

(async () => {
  const updated = [];
  for (const room of rooms) {
    const config = await rest(`/api/config/automation/config/${room.automationId}`);
    await rest(`/api/config/automation/config/${room.automationId}`, "POST", patchConfig(config, room));
    updated.push(room.automationId);
  }
  await rest("/api/services/automation/reload", "POST", {});
  console.log(JSON.stringify({ updated }, null, 2));
})();
