const { connectWs } = require("./ha_ws_util");

(async () => {
  const ws = await connectWs();
  let id = 1;
  const domains = ["input_number", "input_boolean", "input_select", "input_datetime"];
  const result = {};
  for (const domain of domains) {
    const res = await ws.request({ id: ++id, type: `${domain}/list` });
    if (!res.success) throw new Error(JSON.stringify(res));
    result[domain] = {
      count: res.result.length,
      sample: res.result.slice(0, 10).map((item) => item.id),
    };
  }
  ws.close();
  console.log(JSON.stringify(result, null, 2));
})();
