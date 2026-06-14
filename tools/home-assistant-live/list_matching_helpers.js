const { connectWs } = require("./ha_ws_util");

const domains = ["input_number", "input_boolean", "input_select", "input_datetime"];
const patterns = ["livingr", "bedroomb", "manual", "night"];

(async () => {
  const ws = await connectWs();
  let id = 1;
  const result = {};
  for (const domain of domains) {
    const res = await ws.request({ id: ++id, type: `${domain}/list` });
    if (!res.success) throw new Error(JSON.stringify(res));
    result[domain] = res.result
      .map((item) => item.id)
      .filter((helperId) => patterns.some((pattern) => helperId.includes(pattern)))
      .sort();
  }
  ws.close();
  console.log(JSON.stringify(result, null, 2));
})();
