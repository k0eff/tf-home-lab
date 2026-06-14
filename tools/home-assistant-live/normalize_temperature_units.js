const { connectWs } = require("./ha_ws_util");

(async () => {
  const ws = await connectWs();
  let id = 1;
  const list = await ws.request({ id: ++id, type: "input_number/list" });
  if (!list.success) throw new Error(JSON.stringify(list));

  const targets = list.result.filter(
    (item) => /^(livingr|bedroomb)_/.test(item.id) && item.unit_of_measurement === "temperature",
  );

  const updated = [];
  for (const item of targets) {
    const res = await ws.request({
      id: ++id,
      type: "input_number/update",
      input_number_id: item.id,
      name: item.name,
      min: item.min,
      max: item.max,
      step: item.step,
      initial: item.initial,
      mode: item.mode || "box",
      unit_of_measurement: "°C",
    });
    if (!res.success) throw new Error(JSON.stringify(res));
    updated.push(item.id);
  }

  ws.close();
  console.log(JSON.stringify({ updated }, null, 2));
})();
