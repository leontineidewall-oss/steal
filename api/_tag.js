// shared tag rules: used by api/tag.js and inlined into the page
(function (root, f) { if (typeof module === "object" && module.exports) module.exports = f(); else root.TAG = f(); })(this, function () {
  var R = { MELT: 0.05, MAX_MULT: 2, CUT: 0.9, FLOOR: 0.01, TOL: 0.0005 };
  // price of the tag t seconds after it was set at s
  function priceAt(s, setAt, t) {
    if (s == null) return null;
    var h = Math.max(0, t - setAt) / 3600;
    return Math.max(R.FLOOR, s * Math.pow(1 - R.MELT, h));
  }
  function parseMemo(m) {
    if (!m || typeof m !== "string") return null;
    var x = m.match(/(?:^|\s|\])steal:(\d{1,6}(?:\.\d{1,9})?)?(?=$|\s)/i);
    if (x) return { kind: "steal", price: x[1] != null ? Number(x[1]) : null };
    x = m.match(/(?:^|\s|\])pay:([1-9A-HJ-NP-Za-km-z]{16})(?=$|\s)/);
    if (x) return { kind: "pay", ref: x[1] };
    if (/(?:^|\s|\])fee(?=$|\s)/i.test(m)) return { kind: "fee" };
    return null;
  }
  // events: [{sig,t,kind,from,amount(SOL),price,ref}] any order. house = genesis price.
  function replay(events, house) {
    var ev = events.slice().sort(function (a, b) { return a.t - b.t || (a.sig < b.sig ? -1 : 1); });
    var st = { holder: null, paid: null, set: house == null ? null : Number(house), setAt: null, steals: [], fees: [], holders: {} };
    var pays = {};
    ev.forEach(function (e) { if (e.kind === "pay" && e.ref) pays[e.ref] = (pays[e.ref] || 0) + (e.amount || 0); });
    ev.forEach(function (e) {
      if (e.kind === "fee") { st.fees.push({ sig: e.sig, t: e.t, to: e.to || null, amount: e.amount || 0 }); return; }
      if (e.kind !== "steal") return;
      var ask = st.set == null ? null : (st.setAt == null ? st.set : priceAt(st.set, st.setAt, e.t));
      var row = { sig: e.sig, t: e.t, thief: e.from, paid: e.amount, ask: ask, from: st.holder, set: null, status: "void", why: "" };
      if (ask == null) row.why = "not live";
      else if (!(e.amount > 0) || e.amount < ask * (1 - R.TOL)) row.why = "paid under ask";
      else if (e.from && e.from === st.holder) row.why = "already holder";
      else {
        var want = e.price == null ? e.amount : e.price;
        var set = Math.min(Math.max(want, R.FLOOR), e.amount * R.MAX_MULT);
        row.set = set; row.status = "ok";
        row.owed = st.holder ? e.amount * R.CUT : 0;
        row.burn = e.amount - row.owed;
        var k = e.sig.slice(0, 16);
        row.payout = !st.holder ? "house" : (pays[k] ? "paid" : "pending");
        st.holder = e.from; st.paid = e.amount; st.set = set; st.setAt = e.t;
      }
      if (row.status === "void") row.payout = e.amount > 0 ? (pays[e.sig.slice(0, 16)] ? "refunded" : "pending") : "none";
      st.steals.push(row);
    });
    var c = {};
    st.steals.forEach(function (r) { if (r.status === "ok") c[r.thief] = (c[r.thief] || 0) + 1; });
    st.holders = c;
    st.steals.reverse(); st.fees.reverse();
    return st;
  }
  // what you get if you pay p, set s and get stolen after h hours
  function plan(p, s, h, feesPerDay) {
    if (!(p > 0)) return null;
    var set = Math.min(Math.max(s, R.FLOOR), p * R.MAX_MULT);
    var ask = Math.max(R.FLOOR, set * Math.pow(1 - R.MELT, Math.max(0, h)));
    var back = ask * R.CUT, fees = (feesPerDay > 0 ? feesPerDay : 0) * Math.max(0, h) / 24;
    return { set: set, ask: ask, back: back, fees: fees, net: back + fees - p };
  }
  // hours until a price set at s melts down to x
  function hoursTo(s, x) { if (!(s > 0) || !(x > 0) || x >= s) return 0; return Math.log(x / s) / Math.log(1 - R.MELT); }
  return { R: R, priceAt: priceAt, parseMemo: parseMemo, replay: replay, plan: plan, hoursTo: hoursTo };
});
