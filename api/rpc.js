// tiny allowlisted proxy so the browser can build a steal tx without a public key-limited RPC
const { rpc, send, B58 } = require("./_lib");
const OK = { getLatestBlockhash: 1, getBalance: 1, getSignatureStatuses: 1 };
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "post only" });
  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b); } catch (e) { b = null; }
  if (!b || !OK[b.method] || !Array.isArray(b.params || [])) return send(res, 400, { error: "bad request" });
  const p = b.params || [];
  if (b.method === "getBalance" && !B58.test(p[0] || "")) return send(res, 400, { error: "bad address" });
  if (b.method === "getSignatureStatuses" && !(Array.isArray(p[0]) && p[0].length <= 4 && p[0].every(s => /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(s)))) return send(res, 400, { error: "bad sig" });
  try { const r = await rpc(b.method, p); res.setHeader("cache-control", "no-store"); send(res, 200, { result: r }, 0); }
  catch (e) { send(res, 502, { error: "rpc unavailable" }); }
};
