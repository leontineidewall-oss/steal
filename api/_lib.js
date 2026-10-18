const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const env = k => (process.env[k] || "").trim();
const cfg = () => {
  const mint = env("STEAL_MINT"), tag = env("TAG_WALLET"), hp = Number(env("START_PRICE"));
  return {
    mint: B58.test(mint) ? mint : null,
    tag: B58.test(tag) ? tag : null,
    house: hp > 0 && hp < 1e6 ? hp : null,
  };
};
const rpcUrl = () => env("RPC_URL") || "https://api.mainnet-beta.solana.com";
async function get(url, opt = {}, ms = 8000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: ac.signal, headers: { "user-agent": "steal-site/1.0", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error("upstream " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function rpc(method, params) {
  const j = await get(rpcUrl(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (j.error) throw new Error("rpc " + (j.error.code || ""));
  return j.result;
}
function send(res, code, body, age = 15) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", code === 200 ? "public, s-maxage=" + age + ", stale-while-revalidate=" + age * 4 : "no-store");
  res.end(JSON.stringify(body));
}
module.exports = { B58, env, cfg, rpc, get, send };
