const { connectWs } = require("./ha_ws_util");

(async () => {
  const ws = await connectWs();
  let id = 1;
  const res = await ws.request({ id: ++id, type: "input_number/list" });
  if (!res.success) throw new Error(JSON.stringify(res));

  const rows = res.result
    .filter((item) => /^(livingr|bedroomb)_/.test(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit_of_measurement || null,
      min: item.min,
      max: item.max,
      step: item.step,
      mode: item.mode,
      initial: item.initial,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(JSON.stringify(rows, null, 2));
  ws.close();
})();
