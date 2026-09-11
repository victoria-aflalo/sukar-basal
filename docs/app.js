/* סוכר בסל - סריקת קבלה ודירוג סוכרתי. כל העיבוד בדפדפן בלבד. */
'use strict';

let CATALOG = null, PRICES = {};
const fmt = n => '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $ = id => document.getElementById(id);

async function boot() {
  const [cat, pr] = await Promise.all([
    fetch('data/catalog.json').then(r => r.json()),
    fetch('data/prices.json').then(r => r.json()),
  ]);
  CATALOG = cat;
  pr.items.forEach(it => { PRICES[it.id] = it.prices; });
  wireHome(); wireResults(); renderBaskets();
  if (location.hash === '#baskets') show('view-baskets');
}
document.addEventListener('DOMContentLoaded', boot);

function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

/* ============ מסך בית ============ */
function wireHome() {
  $('btnCamera').onclick = () => $('fileImage').click();
  $('btnPdf').onclick = () => $('filePdf').click();
  $('fileImage').onchange = e => { if (e.target.files[0]) runScan(e.target.files[0]); };
  $('filePdf').onchange = e => { if (e.target.files[0]) runScan(e.target.files[0]); };
  $('btnSample').onclick = async e => {
    e.preventDefault();
    show('view-scan'); setScan('טוענים את הקבלה לדוגמה...');
    try {
      const blob = await (await fetch('sample-receipt.png')).blob();
      runScan(new File([blob], 'sample.png', { type: 'image/png' }));
    } catch { setScan('לא נמצאה קבלה לדוגמה. נסו לצלם קבלה אמיתית.'); }
  };
  window.addEventListener('hashchange', () => {
    if (location.hash === '#baskets') show('view-baskets');
    else if (!location.hash) show('view-home');
  });
}

/* ============ OCR (Tesseract.js v5 + pdf.js, מהצנרת של כמה-התייקרה) ============ */
let tessLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (!tessLoading) tessLoading = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    sc.onload = res; sc.onerror = rej;
    document.head.appendChild(sc);
  });
  return tessLoading;
}
let pdfLoading = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (!pdfLoading) pdfLoading = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    sc.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      res();
    };
    sc.onerror = rej;
    document.head.appendChild(sc);
  });
  return pdfLoading;
}

function setScan(msg, showSpinner = true) {
  $('scanStatus').textContent = msg;
  $('spinner').classList.toggle('hidden', !showSpinner);
}

async function runScan(file) {
  show('view-scan');
  try {
    let source = file;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      setScan('פותחים את קובץ ה־PDF...');
      await loadPdfJs();
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      source = canvas.toDataURL('image/png');
    }
    setScan('טוענים את מנוע הקריאה (בפעם הראשונה לוקח כמה שניות)...');
    await loadTesseract();
    setScan('קוראים את הקבלה... כמה שניות והתוצאה אצלכם');
    const { data } = await window.Tesseract.recognize(source, 'heb+eng');
    const result = analyzeReceipt(data.text || '');
    if (!result.rated.length) {
      setScan('לא זיהינו מוצרי מזון בקבלה. נסו תמונה חדה וישרה יותר.', false);
      setTimeout(() => show('view-home'), 3500);
      return;
    }
    renderResults(result);
    show('view-results');
  } catch (e) {
    console.error(e);
    setScan('הסריקה נכשלה. נסו שוב עם תמונה ברורה יותר.', false);
    setTimeout(() => show('view-home'), 3500);
  }
}

/* ============ התאמת שורות קבלה (לוגיקת כמה-התייקרה, מורחבת) ============ */
const RSTOP = new Set(['גרם','מ״ל','מל','ליטר','ק״ג','יח','יח׳','יחידות']);
const RECEIPT_NOISE = ['קופה','סניף','אשרא','סהכ','סה"כ','תשלום','תודה','מזומן','עודף','מעמ','מע״מ','תאריך','שולם','חייב','זכאי','עסקה','כרטיס','שקל','הנחה','מחיר','סכום','יתרה'];
function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 1) return 2;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[m][n];
}
function tokMatch(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (Math.min(a.length, b.length) >= 4 && lev(a, b) <= 1) return true;
  return false;
}
const rnorm = str => str.replace(/[״"׳']/g, '').replace(/[^֐-׿a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

let ITOKENS = null;
function buildTokens() {
  ITOKENS = {};
  for (const it of CATALOG.items) {
    const src = rnorm((it.tokens || []).join(' ') + ' ' + it.name_he);
    ITOKENS[it.id] = [...new Set(src.split(' ').filter(w => w.length >= 2 && !RSTOP.has(w) && !/^\d+$/.test(w)))];
  }
}

function matchCatalogLine(ltoks) {
  let best = null, bestScore = 0;
  for (const it of CATALOG.items) {
    const toks = ITOKENS[it.id];
    let score = 0, exact = 0;
    for (const t of toks) {
      if (ltoks.includes(t)) { score++; exact++; }
      else if (ltoks.some(l => tokMatch(l, t))) score++;
    }
    if (score >= 2 && exact >= 1 && score > bestScore) { best = it; bestScore = score; }
  }
  return best;
}
function matchRuleLine(line) {
  for (const rule of CATALOG.rules) {
    if (rule.tokens.some(t => line.includes(t))) return rule;
  }
  return null;
}

function analyzeReceipt(text) {
  buildTokens();
  const lines = text.split('\n').map(rnorm).filter(l => l.replace(/[0-9 ]/g, '').length >= 3);
  const seen = {}; const unmatched = [];
  for (const line of lines) {
    if (RECEIPT_NOISE.some(w => line.includes(w))) continue;
    const ltoks = line.split(' ').filter(w => w.length >= 2);
    const item = matchCatalogLine(ltoks);
    if (item) {
      if (!seen[item.id]) seen[item.id] = { kind:'catalog', item, count:0 };
      seen[item.id].count++;
      continue;
    }
    const rule = matchRuleLine(line);
    if (rule) {
      const key = 'rule:' + rule.label;
      if (!seen[key]) seen[key] = { kind:'rule', rule, examples:[], count:0 };
      seen[key].count++;
      if (seen[key].examples.length < 2) seen[key].examples.push(line);
      continue;
    }
    unmatched.push(line);
  }
  const rated = Object.values(seen);
  return { rated, unmatched };
}

/* ============ תוצאות ============ */
const RATING_HE = { g:'ירוק', y:'צהוב', r:'אדום', n:'לא מזון' };
const RATING_ICON = { g:'✔', y:'!', r:'✖', n:'–' };
let lastResult = null;

function renderResults(result) {
  lastResult = result;
  const counts = { g:0, y:0, r:0 };
  result.rated.forEach(x => { const rr = x.kind === 'catalog' ? x.item.rating : x.rule.rating; if (counts[rr] !== undefined) counts[rr]++; });
  $('summaryChips').innerHTML =
    `<div class="chip g">${counts.g}<small>ירוק</small></div><div class="chip y">${counts.y}<small>צהוב</small></div><div class="chip r">${counts.r}<small>אדום</small></div>`;

  const order = { r:0, y:1, g:2, n:3 };
  const sorted = [...result.rated].sort((a, b) => {
    const ra = a.kind === 'catalog' ? a.item.rating : a.rule.rating;
    const rb = b.kind === 'catalog' ? b.item.rating : b.rule.rating;
    return order[ra] - order[rb];
  });

  $('resultsList').innerHTML = sorted.map(x => {
    if (x.kind === 'catalog') {
      const it = x.item;
      const price = PRICES[it.id] ? fmt(Math.min(...Object.values(PRICES[it.id]))) : null;
      const swaps = (it.swaps || []).map(s => `
        <div class="swap-body">${s.img ? `<img class="pimg swap-img" src="${s.img}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <div class="swap-txt"><b>${s.name}</b>
        <div class="where">איפה קונים: ${s.where}</div></div></div>`).join('');
      return `<div class="item">
        <div class="item-head"><div class="badge ${it.rating}">${RATING_ICON[it.rating]}</div>
          <div class="name">${it.name_he}${price ? ` <span class="est">${price}</span>` : ''}</div>
          ${it.img ? `<img class="pimg" src="${it.img}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>
        ${it.why ? `<div class="why">${it.why}</div>` : ''}
        ${swaps ? `<div class="swap"><div class="swap-title"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 8h13l-3-3M20 16H7l3 3" stroke="#1E7B34" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>החליפו בקנייה הבאה:</div>${swaps}</div>` : ''}
      </div>`;
    }
    const rule = x.rule;
    return `<div class="item">
      <div class="item-head"><div class="badge ${rule.rating}">${RATING_ICON[rule.rating]}</div>
        <div class="name">${rule.label}<span class="est">זיהוי כללי</span></div></div>
      <div class="why">${rule.why}${rule.note ? ` ${rule.note}` : ''}</div>
      <div class="why" style="font-size:14px;color:var(--ink3)">זוהה בשורה: ${x.examples.join(' · ')}</div>
    </div>`;
  }).join('') + (result.unmatched.length ? `
    <details class="unmatched"><summary>${result.unmatched.length} שורות לא זוהו (לחצו לצפייה)</summary>
      ${result.unmatched.slice(0, 20).map(l => `<div>${l}</div>`).join('')}
    </details>` : '');

  const q = CATALOG.quotas;
  $('quotas').innerHTML = `
    <h2>מכסות יומיות פשוטות (כלליות)</h2>
    <div class="quota"><div class="q-title">סוכר מוסף</div><div class="q-val">${q.sugar.value}</div><div class="q-src">מקור: ${q.sugar.source}</div></div>
    <div class="quota"><div class="q-title">נתרן (מלח)</div><div class="q-val">${q.sodium.value}</div><div class="q-src">מקור: ${q.sodium.source}</div></div>
    <div class="quota"><div class="q-title">סיבים תזונתיים</div><div class="q-val">${q.fiber.value}</div><div class="q-src">מקור: ${q.fiber.source}</div></div>
    <p class="q-note">${q.note}</p>`;
}

function swapMessage() {
  if (!lastResult) return '';
  const reds = lastResult.rated.filter(x => x.kind === 'catalog' && x.item.rating === 'r');
  const lines = ['סוכר בסל - ההחלפות שלי לקנייה הבאה:'];
  reds.forEach(x => {
    x.item.swaps.forEach(s => lines.push(`• במקום ${x.item.name_he}: ${s.name} (${s.where})`));
  });
  lines.push('', 'הכוונה כללית - לא ייעוץ רפואי');
  return lines.join('\n');
}

function wireResults() {
  $('btnShare').onclick = () => {
    const msg = swapMessage();
    if (!msg) return;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  };
  $('btnAgain').onclick = () => show('view-home');
  $('btnHome').onclick = () => { location.hash = ''; show('view-home'); };
}

/* ============ סלים לדוגמה ============ */
function basketTotals(basket) {
  const totals = {}; const priced = [];
  basket.items.forEach(it => {
    if (!it.id) return;
    const pr = PRICES[it.id]; if (!pr) return;
    priced.push(it);
    Object.entries(pr).forEach(([ch, v]) => { totals[ch] = (totals[ch] || 0) + v * (it.qty || 1); });
  });
  return { totals, pricedCount: priced.length };
}

function renderBaskets() {
  const chains = CATALOG.chains;
  $('basketsList').innerHTML = CATALOG.baskets.map((b, i) => {
    const { totals } = basketTotals(b);
    const keys = Object.keys(totals);
    const cheapest = keys.sort((a, b2) => totals[a] - totals[b2])[0];
    const minTotal = keys.length ? totals[cheapest] : null;
    const perServing = b.servings && minTotal ? minTotal / b.servings : null;
    const rows = b.items.map(it => {
      if (it.free) return `<div class="b-row free"><span>${it.free}</span><span class="p">${it.note || ''}</span></div>`;
      const cat = CATALOG.items.find(c => c.id === it.id);
      const pr = PRICES[it.id];
      const price = pr ? Math.min(...Object.values(pr)) * (it.qty || 1) : null;
      return `<div class="b-row"><span>${cat ? cat.name_he : it.id}${it.qty > 1 ? ` ×${it.qty}` : ''}</span><span class="p">${price ? fmt(price) : ''}</span></div>`;
    }).join('');
    const chainRows = keys.map(ch => `
      <div class="b-chain-row ${ch === cheapest ? 'best' : ''}"><span>${chains[ch]}</span><span>${fmt(totals[ch])}${ch === cheapest ? ' ✔ הזול' : ''}</span></div>`).join('');
    return `<div class="basket" id="basket-${b.id}">
      <button class="basket-head" data-b="${b.id}">
        <div class="b-title"><b>${b.title}</b><span>${b.desc}${perServing ? ` · ${fmt(perServing)} למנה` : ''}${b.servings ? ` · ${b.servings} מנות` : ''}</span></div>
        <div class="chev">⌄</div>
      </button>
      <div class="basket-body">
        <div class="b-table"><div class="b-row head"><span>מה קונים</span><span>מחיר (הזול בין הרשתות)</span></div>${rows}
        ${minTotal ? `<div class="b-row total"><span>סה״כ פריטים מתומחרים</span><span class="p">${fmt(minTotal)}</span></div>` : ''}</div>
        ${keys.length ? `<div class="b-chains"><h3>אותם פריטים בכל רשת:</h3>${chainRows}</div>` : ''}
        <button class="b-share" data-share="${b.id}">שלחו את הסל לוואטסאפ</button>
        <div class="b-note">מחירים מתוך קובצי שקיפות המחירים, עודכנו: ${CATALOG.updated}. פריטים טריים (ירקות ופירות) מסומנים בלי מחיר - לפי הסניף.</div>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.basket-head').forEach(btn => {
    btn.onclick = () => btn.closest('.basket').classList.toggle('open');
  });
  document.querySelectorAll('.b-share').forEach(btn => {
    btn.onclick = () => {
      const b = CATALOG.baskets.find(x => x.id === btn.dataset.share);
      const { totals } = basketTotals(b);
      const keys = Object.keys(totals);
      const cheapest = keys.sort((a, b2) => totals[a] - totals[b2])[0];
      const lines = [`סוכר בסל - ${b.title}:`];
      b.items.forEach(it => {
        if (it.free) { lines.push(`• ${it.free}`); return; }
        const cat = CATALOG.items.find(c => c.id === it.id);
        const pr = PRICES[it.id];
        const price = pr ? fmt(Math.min(...Object.values(pr)) * (it.qty || 1)) : '';
        lines.push(`• ${cat ? cat.name_he : it.id}${it.qty > 1 ? ` ×${it.qty}` : ''} ${price}`);
      });
      if (keys.length) lines.push(`סה״כ מתומחר: ${fmt(totals[cheapest])} (${CATALOG.chains[cheapest]})`);
      lines.push('', 'הכוונה כללית - לא ייעוץ רפואי');
      window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
    };
  });
}
