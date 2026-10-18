const { cfg, send } = require("./_lib");
module.exports = (req, res) => { const c = cfg(); send(res, 200, { mint: c.mint, tag: c.tag, house: c.house, live: !!(c.mint && c.tag && c.house) }, 60); };
