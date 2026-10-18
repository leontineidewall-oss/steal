const { cfg, rpc, send } = require("./_lib");
const T = require("./_tag");
const LAM = 1e9;
// SOL moved by the fee payer into to inside a parsed tx (system transfers only)
function moved(tx, from, to) {
  let s = 0;
  const ins = [].concat((tx.transaction.message.instructions || []), ...((tx.meta && tx.meta.innerInstructions) || []).map(x => x.instructions || []));
  for (const i of ins) {
    const p = i.parsed;
    if (i.program === "system" && p && p.type === "transfer" && p.info && p.info.destination === to && (!from || p.info.source === from)) s += Number(p.info.lamports) || 0;
  }
  return s / LAM;
}
function payer(tx) { const k = tx.transaction.message.accountKeys[0]; return typeof k === "string" ? k : k && k.pubkey; }
module.exports = async (req, res) => {
  const c = cfg();
  if (!c.tag || c.house == null) return send(res, 200, { live: false }, 30);
  try {
    const [sigs, bal] = await Promise.all([rpc("getSignaturesForAddress", [c.tag, { limit: 300 }]), rpc("getBalance", [c.tag])]);
    const keep = [];
    for (const s of sigs || []) {
      if (s.err || !s.blockTime) continue;
      const m = T.parseMemo(s.memo || "");
      if (m) keep.push({ s, m });
    }
    const top = keep.slice(0, 80);
    const txs = await Promise.all(top.map(k => rpc("getTransaction", [k.s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)));
    const ev = [];
    top.forEach((k, i) => {
      const tx = txs[i]; if (!tx) return;
      const from = payer(tx);
      if (k.m.kind === "steal") ev.push({ sig: k.s.signature, t: k.s.blockTime, kind: "steal", from, amount: moved(tx, from, c.tag), price: k.m.price });
      else if (from === c.tag) {
        const outs = (tx.transaction.message.instructions || []).filter(i => i.program === "system" && i.parsed && i.parsed.type === "transfer" && i.parsed.info.source === c.tag);
        const amt = outs.reduce((a, i) => a + Number(i.parsed.info.lamports || 0), 0) / LAM, to = outs[0] ? outs[0].parsed.info.destination : null;
        ev.push({ sig: k.s.signature, t: k.s.blockTime, kind: k.m.kind, ref: k.m.ref, amount: amt, to });
      }
    });
    const st = T.replay(ev, c.house);
    send(res, 200, { live: true, t: Math.floor(Date.now() / 1000), wallet: c.tag, balance: (bal && bal.value != null ? bal.value : bal) / LAM,
      holder: st.holder, paid: st.paid, set: st.set, setAt: st.setAt, steals: st.steals.slice(0, 50), fees: st.fees.slice(0, 30), crew: st.holders, scanned: (sigs || []).length }, 10);
  } catch (e) { send(res, 502, { live: true, error: "chain unavailable" }); }
};
