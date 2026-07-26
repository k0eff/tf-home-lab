const { connectWs } = require("./ha_ws_util");

const CARD_MARKER = "### Comfort Program Season";

function buildSeasonCard() {
  return {
    type: "markdown",
    content: `${CARD_MARKER}
{% set climate_mode = 'winter' if now().month in [12, 1, 2] else 'summer' %}
{% if climate_mode == 'winter' %}
<ha-alert alert-type="info">Winter — heating mode ({{ now().strftime('%B') }})</ha-alert>
{% else %}
<ha-alert alert-type="warning">Summer — cooling mode ({{ now().strftime('%B') }})</ha-alert>
{% endif %}
Fan boost active: LivingR {{ 'ON' if is_state('input_boolean.livingr_fan_boost_active', 'on') else 'off' }} · BedroomB {{ 'ON' if is_state('input_boolean.bedroomb_fan_boost_active', 'on') else 'off' }} · BedroomS {{ 'ON' if is_state('input_boolean.bedrooms_fan_boost_active', 'on') else 'off' }}`,
  };
}

(async () => {
  const ws = await connectWs();
  let id = 9100;

  const res = await ws.request({ id: ++id, type: "lovelace/config", url_path: "my-dash" });
  if (!res.success) throw new Error(JSON.stringify(res));
  const dash = res.result;

  const view = dash.views.find((v) => v.title === "AirCon");
  if (!view) throw new Error("AirCon view not found");

  const existingIdx = view.cards.findIndex((c) => c.type === "markdown" && c.content && c.content.includes(CARD_MARKER));
  if (existingIdx >= 0) {
    view.cards[existingIdx] = buildSeasonCard();
  } else {
    view.cards.splice(3, 0, buildSeasonCard());
  }

  const save = await ws.request({ id: ++id, type: "lovelace/config/save", url_path: "my-dash", config: dash });
  if (!save.success) throw new Error(JSON.stringify(save));

  ws.close();
  console.log(existingIdx >= 0 ? "updated existing season card" : "inserted new season card at index 3");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
