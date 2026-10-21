// موتور تشخیص علائم (بدون DOM و بدون هوش مصنوعی). هم در مرورگر و هم در Node اجرا می‌شود.
const E = (function () {
  const kb = typeof KB !== 'undefined' ? KB : require('./kb.js');
  const norm = s => (s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/[\u200c\u200f\u064b-\u065f]/g, ' ')
    .replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).toLowerCase();
  const sq = s => norm(s).replace(/[\s.,،؛؟?!:;()"'«»\-_]+/g, '');
  const NEG = /(ندارم|ندارد|نداره|نیست|نداشتم|نشد|نبود|نمیکنم)/;
  const parts = k => k.split('+').map(p => p.split('|'));
  function find(q, alt) {
    const skip = alt[0] === '!', w = sq(skip ? alt.slice(1) : alt);
    for (let i = q.indexOf(w); i >= 0; i = q.indexOf(w, i + 1)) {
      if (skip) return true;
      const after = q.slice(i + w.length, i + w.length + 14).split(/ولی|اما/)[0], before = q.slice(Math.max(0, i - 4), i);
      if (!NEG.test(after) && !/(بدون|هیچ)$/.test(before)) return true;
    }
    return false;
  }
  function match(text) {
    const q = sq(text), out = [];
    for (const e of kb) {
      let best = 0;
      for (const k of e.kw) { const ps = parts(k); if (ps.every(p => p.some(a => find(q, a)))) best = Math.max(best, ps.length); }
      if (best) out.push({ e, score: best });
    }
    return out.sort((a, b) => b.e.lv - a.e.lv || b.score - a.score).map(x => x.e);
  }
  // سطح نهایی: پاسخ «بله» فقط می‌تواند فوریت را بالا ببرد
  const level = (e, ans) => ans.reduce((lv, a, i) => (a && e.qs[i] ? Math.max(lv, e.qs[i][1]) : lv), e.lv);
  return { match, level, KB: kb, sq };
})();
if (typeof module !== 'undefined') module.exports = E;
