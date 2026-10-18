const { cfg, get, send, env } = require("./_lib");
module.exports = async (req, res) => {
  const { mint } = cfg();
  if (!mint) return send(res, 200, { live: false }, 60);
  try {
    const j = await get((env("DEX_BASE") || "https://api.dexscreener.com") + "/token-pairs/v1/solana/" + mint);
    const ps = (Array.isArray(j) ? j : []).filter(p => p && p.baseToken && p.baseToken.address === mint);
    if (!ps.length) return send(res, 200, { live: true, pair: null, t: Date.now() }, 30);
    ps.sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0));
    const p = ps[0], n = v => (typeof v === "number" && isFinite(v) ? v : v != null && isFinite(+v) ? +v : null);
    send(res, 200, { live: true, t: Date.now(), pair: {
      dex: p.dexId || null, price: n(p.priceUsd), priceSol: p.quoteToken && p.quoteToken.symbol === "SOL" ? n(p.priceNative) : null,
      mcap: n(p.marketCap != null ? p.marketCap : p.fdv), vol: n((p.volume || {}).h24), liq: n((p.liquidity || {}).usd),
      chg: n((p.priceChange || {}).h24), buys: n(((p.txns || {}).h24 || {}).buys), sells: n(((p.txns || {}).h24 || {}).sells),
    } }, 30);
  } catch (e) { send(res, 502, { live: true, error: "market unavailable" }); }
};
