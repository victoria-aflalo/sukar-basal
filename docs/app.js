/* סוכר בסל - סריקת קבלה ודירוג סוכרתי. כל העיבוד בדפדפן בלבד. */
'use strict';

let CATALOG = null, PRICES = {};
const fmt = n => '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $ = id => document.getElementById(id);

let MEALS = null, NUTMODEL = null, NUTFACTS = null;
async function boot() {
  const [cat, pr, ml, nm, nf] = await Promise.all([
    fetch('data/catalog.json').then(r => r.json()),
    fetch('data/prices.json').then(r => r.json()),
    fetch('data/meals.json').then(r => r.json()),
    fetch('data/nutrition-model.json').then(r => r.json()),
    fetch('data/nutrition-facts.json').then(r => r.json()),
  ]);
  NUTMODEL = nm; NUTFACTS = nf.facts;
  CATALOG = cat;
  cat.items.forEach(it => { CAT_BY_ID[it.id] = it; });
  pr.items.forEach(it => { PRICES[it.id] = it.prices; });
  MEALS = ml;
  wireHome(); wireResults(); renderHomeSwaps(); wireSearch(); renderBaskets(); wireDrawer(); renderProfile(); renderMeals();
  if (location.hash === '#baskets') show('view-baskets');
  else if (location.hash === '#meals') show('view-meals');
  else if (location.hash === '#search') show('view-search');
}
document.addEventListener('DOMContentLoaded', boot);

function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}


/* ============ החלפה חכמה של השבוע (מסך הבית) ============
   הכרטיסים נבנים מהקטלוג ומנתוני התזונה בזמן ריצה - לא HTML קבוע.
   כרטיס מוצג רק אם לשני הצדדים יש ערך סוכר מאומת וההפרש משמעותי. */
const HOME_SWAPS = [
  { before: '7290000075143', beforeName: "עוגיות שוקוצ'יפס", after: 'cottage', afterName: "קוטג' 5%" },
  { before: '5410126116953', beforeName: 'ממרח לוטוס', after: 'cottage', afterName: "קוטג' 5%" },
  { before: 'cola', beforeName: 'קוקה קולה', after: '7290000136158', afterName: 'קולה זירו', note: 'כמעבר בלבד, לא כהרגל' },
  { before: 'milk', beforeName: 'חלב 3%', after: 'soy_milk', afterName: 'משקה סויה ללא סוכר' },
];
function renderHomeSwaps() {
  const host = $('homeSwapsList');
  if (!host) return;
  const cards = [];
  for (const cfg of HOME_SWAPS) {
    const b = CAT_BY_ID[cfg.before], a = CAT_BY_ID[cfg.after];
    if (!b || !a) continue;
    const bf = factsOf(b), af = factsOf(a);
    if (!bf || !af || bf.sugars == null || af.sugars == null) continue;
    const d = rnd1(bf.sugars - af.sugars);
    if (d < 2) continue;
    const unit = isLiquidItem(b) ? '100 מ״ל' : '100 גרם';
    const bimg = b.img || (b.barcode ? `https://img.rami-levy.co.il/product/${b.barcode}/medium.jpg` : '');
    const aimg = a.img || (a.barcode ? `https://img.rami-levy.co.il/product/${a.barcode}/medium.jpg` : '');
    cards.push(`<div class="sw-card">
      <div class="sw-sides">
        <div class="sw-side">
          ${bimg ? `<img src="${bimg}" alt="" loading="lazy" onerror="this.remove()">` : ''}
          <b>${cfg.beforeName || b.name_he}</b>
          <span class="sw-g r">${rnd1(bf.sugars)} גרם סוכר</span>
          <small>ל-${unit} ≈ ${rnd1(bf.sugars / TSP_G)} כפיות</small>
        </div>
        <div class="sw-arrow" aria-hidden="true">←</div>
        <div class="sw-side">
          ${aimg ? `<img src="${aimg}" alt="" loading="lazy" onerror="this.remove()">` : ''}
          <b>${cfg.afterName || a.name_he}</b>
          <span class="sw-g g">${rnd1(af.sugars)} גרם סוכר</span>
          <small>ל-${unit}</small>
        </div>
      </div>
      <div class="sw-save">חיסכון של <b>${d} גרם</b> סוכר בכל ${unit}${cfg.note ? ' - ' + cfg.note : ''}</div>
    </div>`);
  }
  host.innerHTML = cards.join('');
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
    else if (location.hash === '#meals') show('view-meals');
    else if (location.hash === '#search') show('view-search');
    else if (!location.hash) show('view-home');
  });
}

/* ============ תפריט צד ============ */
function wireDrawer() {
  const open = () => { $('drawer').hidden = false; $('drawerOverlay').hidden = false; };
  const close = () => { $('drawer').hidden = true; $('drawerOverlay').hidden = true; };
  $('btnMenu').onclick = open;
  $('drawerOverlay').onclick = close;
  document.querySelectorAll('#drawer .drawer-link').forEach(a => {
    a.onclick = e => {
      e.preventDefault(); close();
      const nav = a.dataset.nav;
      if (nav === 'home') { history.replaceState(null, '', location.pathname); show('view-home'); }
      else { location.hash = nav; show('view-' + nav); }
    };
  });
  $('btnHomeMeals').onclick = () => { history.replaceState(null, '', location.pathname); show('view-home'); };
}

/* ============ מודל תזונתי + פרופיל ============ */
let PROFILE = null;
try { PROFILE = JSON.parse(localStorage.getItem('sukar_profile') || 'null'); } catch {}

function profileKey() {
  const older = PROFILE.age === '65plus';
  const active = PROFILE.training === 'yes';
  return (older ? 'older' : 'adult') + '_' + (active ? 'active' : 'sedentary');
}

function computeTargets() {
  if (!PROFILE || !PROFILE.weight) return null;
  const w = PROFILE.weight;
  const older = PROFILE.age === '65plus';
  const range = NUTMODEL.protein.daily_g_per_kg[profileKey()];
  const meal = NUTMODEL.protein.per_meal_g[older ? 'older' : 'adult'];
  return {
    proteinDaily: [Math.round(range[0] * w), Math.round(range[1] * w)],
    proteinMeal: meal,
    carbsMeal: [NUTMODEL.carbs.per_meal_exchanges[0] * NUTMODEL.carbs.exchange_g, NUTMODEL.carbs.per_meal_exchanges[1] * NUTMODEL.carbs.exchange_g],
    fiber: NUTMODEL.fiber.daily_target_g,
    older,
  };
}

function renderProfile() {
  const box = $('profileBox');
  if (!box) return;
  const chip = (field, val, label) => `<button type="button" class="p-chip ${PROFILE && PROFILE[field] === val ? 'on' : ''}" data-field="${field}" data-val="${val}">${label}</button>`;
  if (!PROFILE) {
    box.innerHTML = `<div class="profile-card">
      <h2>התאמה אישית של היעדים</h2>
      <p class="p-sub">הזינו שלושה פרטים והיעדים התזונתיים יחושבו בשבילכם לפי הנחיות ADA ומשרד הבריאות. הנתונים נשמרים רק בטלפון שלכם.</p>
      <div class="p-field"><label class="p-label">משקל</label>
        <div class="p-weight"><input id="pw" type="number" inputmode="numeric" min="40" max="200" placeholder="70"><span>ק"ג</span></div></div>
      <div class="p-field"><label class="p-label">גיל</label>
        <div class="p-chips">${chip('age','under65','מתחת ל-65')}${chip('age','65plus','65 ומעלה')}</div></div>
      <div class="p-field"><label class="p-label">פעילות גופנית קבועה (3+ בשבוע)</label>
        <div class="p-chips">${chip('training','no','לא מתאמן/ת')}${chip('training','yes','מתאמן/ת')}</div></div>
      <button class="p-save" id="pSave">חשבו את היעדים שלי</button>
      ${sourcesHtml()}
    </div>`;
  } else {
    const t = computeTargets();
    box.innerHTML = `<div class="profile-card">
      <h2>היעדים היומיים שלכם</h2>
      <p class="p-sub">לפי משקל ${PROFILE.weight} ק"ג, ${PROFILE.age === '65plus' ? 'גיל 65+' : 'מתחת ל-65'}, ${PROFILE.training === 'yes' ? 'עם פעילות גופנית קבועה' : 'ללא פעילות קבועה'}.</p>
      <div class="p-targets">
        <div class="p-target"><span class="t-dot"></span><span>חלבון ליום: <b>${t.proteinDaily[0]}-${t.proteinDaily[1]} גרם</b></span></div>
        <div class="p-target"><span class="t-dot"></span><span>חלבון לארוחה: <b>${t.proteinMeal[0]}-${t.proteinMeal[1]} גרם</b>${t.older ? ' (סף אנאבולי לגיל 65+)' : ''}</span></div>
        <div class="p-target"><span class="t-dot"></span><span>פחמימות לארוחה: <b>${t.carbsMeal[0]}-${t.carbsMeal[1]} גרם</b>, עדיף מלאות ועתירות סיבים</span></div>
        <div class="p-target"><span class="t-dot"></span><span>סיבים ליום: <b>${t.fiber[0]}-${t.fiber[1]} גרם</b></span></div>
        <div class="p-target"><span class="t-dot"></span><span>שומן: עדיף בלתי רווי - שמן זית, טחינה, אבוקדו</span></div>
      </div>
      <p class="p-ckd">${NUTMODEL.protein.ckd_note}</p>
      <button class="p-edit" id="pEdit">עריכת הפרטים</button>
      ${sourcesHtml()}
    </div>`;
  }
  box.querySelectorAll('.p-chip').forEach(b => b.onclick = () => {
    box.querySelectorAll(`.p-chip[data-field="${b.dataset.field}"]`).forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  });
  const save = $('pSave');
  if (save) save.onclick = () => {
    const w = parseInt(($('pw') || {}).value || '0', 10);
    const age = (box.querySelector('.p-chip.on[data-field="age"]') || {}).dataset;
    const tr = (box.querySelector('.p-chip.on[data-field="training"]') || {}).dataset;
    if (!(w >= 40 && w <= 200)) { $('pw').focus(); $('pw').style.borderColor = 'var(--red)'; return; }
    if (!age || !tr) { return; }
    PROFILE = { weight: w, age: age.val, training: tr.val };
    localStorage.setItem('sukar_profile', JSON.stringify(PROFILE));
    renderProfile();
  };
  const edit = $('pEdit');
  if (edit) edit.onclick = () => { const keep = PROFILE; PROFILE = null; renderProfile();
    $('pw').value = keep.weight;
    box.querySelectorAll(`.p-chip[data-field="age"][data-val="${keep.age}"], .p-chip[data-field="training"][data-val="${keep.training}"]`).forEach(x => x.classList.add('on'));
  };
}

function sourcesHtml() {
  const items = (NUTMODEL ? NUTMODEL.sources : []).map(s => `<li><b>${s.name}</b><br>${s.supports}<br><a href="${s.url}" target="_blank" rel="noopener">${s.url}</a></li>`).join('');
  return `<details class="p-sources"><summary>מקורות ההנחיות (ADA, משרד הבריאות, WHO)</summary><ul>${items}</ul>
    <p style="margin-top:8px">היעדים הם הכוונה כללית מהספרות המקצועית, לא תחליף לתפריט אישי מדיאטנית.</p></details>`;
}

/* ============ ארוחות מומלצות ============ */
function mealMacros(items) {
  let p = 0, c = 0, f = 0;
  items.forEach(ent => {
    const nf = NUTFACTS && NUTFACTS[ent.id];
    const g = ent.serving_g || 0;
    if (!nf || !g) return;
    p += nf.p * g / 100; c += nf.c * g / 100; f += nf.f * g / 100;
  });
  return { p: Math.round(p), c: Math.round(c), f: Math.round(f) };
}
function macrosHtml(items, slot) {
  if (!NUTFACTS) return '';
  const m = mealMacros(items);
  let target = '';
  try {
    const t = slot === 'snack' ? null : computeTargets();
    if (t) {
      const ok = m.p >= t.proteinMeal[0];
      target = `<span class="macro target ${ok ? 'ok' : ''}">חלבון: ${m.p} גרם מתוך יעד ${t.proteinMeal[0]}-${t.proteinMeal[1]}</span>`;
    }
  } catch {}
  return `<div class="meal-macros">
    <span class="macro">חלבון ${m.p} גרם</span><span class="macro">פחמימה ${m.c} גרם</span><span class="macro">שומן ${m.f} גרם</span>${target}
  </div>`;
}
const CAT_BY_ID = {};
function itemMinPrice(id) {
  const pr = PRICES[id];
  return pr ? Math.min(...Object.values(pr)) : null;
}
function renderMeals() {
  if (!MEALS) return;
  CATALOG.items.forEach(it => { CAT_BY_ID[it.id] = it; });
  const slotIcon = {
    breakfast: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#B45309"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" stroke="#B45309" stroke-width="1.8" stroke-linecap="round"/></svg>',
    lunch: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="7" fill="#0D6E63"/><circle cx="12" cy="13" r="4.5" fill="#FAF7F2"/><circle cx="12" cy="13" r="2" fill="#0D6E63"/></svg>',
    dinner: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" fill="#0D6E63"/></svg>',
    snack: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" fill="#1E7B34"/><path d="M8.5 12h7M12 8.5v7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  const html = MEALS.slots.map(slot => {
    const opts = MEALS.options.filter(o => o.slot === slot.key);
    if (!opts.length) return '';
    return `<div class="meal-slot">${slotIcon[slot.key] || ''} ${slot.title}</div>` + opts.map(o => {
      const rows = o.items.map(ent => {
        const it = CAT_BY_ID[ent.id];
        if (!it) return '';
        const p = itemMinPrice(ent.id);
        const eff = p != null ? p * (ent.share || 1) : null;
        return `<div class="meal-item">
          ${it.img ? `<img class="mi-img" src="${it.img}" alt="" loading="lazy" onerror="this.remove()">` : ''}
          <span class="mi-name">${it.name_he}<small class="mi-qty">${ent.qty || ''}</small></span>
          <span class="mi-price">${eff != null ? (ent.est ? '≈' : '') + fmt(eff) : 'מחיר חסר'}</span>
        </div>`;
      }).join('');
      const priced = o.items.map(ent => { const v = itemMinPrice(ent.id); return v != null ? v * (ent.share || 1) : null; }).filter(v => v != null);
      const total = priced.length === o.items.length && priced.length ? priced.reduce((a, b) => a + b, 0) : null;
      const hasEst = o.items.some(ent => ent.est);
      return `<div class="meal-card">
        <div class="meal-head"><span class="meal-name">${o.name}</span>${total != null ? `<span class="meal-total">${fmt(total)}</span>` : ''}</div>
        <div class="meal-note">${o.note}</div>
        <div class="meal-items">${rows}</div>
        ${macrosHtml(o.items, o.slot)}
        <span class="meal-badge"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1E7B34"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>כל הרכיבים ירוקים</span>
        ${hasEst ? '<div class="meal-note" style="margin:6px 0 0">≈ כמות מוערכת - גודל האריזה לא פורסם</div>' : ''}
      </div>`;
    }).join('');
  }).join('');
  $('mealsList').innerHTML = html;
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


/* חידוד תמונת קבלה לפני OCR: הגדלה, גווני אפור, מתיחת ניגודיות, חידוד */
function preprocessReceipt(source) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.max(1, Math.min(3, 2000 / img.width));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d');
        cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
        cx.drawImage(img, 0, 0, w, h);
        const d = cx.getImageData(0, 0, w, h), px = d.data;
        const n = w * h;
        const g = new Float32Array(n);
        let mn = 255, mx = 0;
        for (let i = 0, j = 0; j < n; i += 4, j++) {
          const v = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          g[j] = v; if (v < mn) mn = v; if (v > mx) mx = v;
        }
        const rng = Math.max(20, mx - mn);
        for (let j = 0; j < n; j++) g[j] = Math.min(255, Math.max(0, (g[j] - mn) * 255 / rng));
        // box blur radius 2 (two passes) for unsharp
        const tmp = new Float32Array(n), blur = new Float32Array(n);
        for (let y = 0; y < h; y++) {
          let acc = 0;
          for (let x = -2; x <= 2; x++) acc += g[y * w + Math.min(w - 1, Math.max(0, x))];
          for (let x = 0; x < w; x++) {
            tmp[y * w + x] = acc / 5;
            const xa = Math.min(w - 1, x + 3), xs = Math.max(0, x - 2);
            acc += g[y * w + xa] - g[y * w + xs];
          }
        }
        for (let x = 0; x < w; x++) {
          let acc = 0;
          for (let y = -2; y <= 2; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
          for (let y = 0; y < h; y++) {
            blur[y * w + x] = acc / 5;
            const ya = Math.min(h - 1, y + 3), ys = Math.max(0, y - 2);
            acc += tmp[ya * w + x] - tmp[ys * w + x];
          }
        }
        for (let i = 0, j = 0; j < n; i += 4, j++) {
          let v = g[j] * 1.7 - blur[j] * 0.7;
          v = v < 0 ? 0 : v > 255 ? 255 : v;
          px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
        }
        cx.putImageData(d, 0, 0);
        resolve(cv.toDataURL('image/png'));
      } catch (e) { resolve(source); }
    };
    img.onerror = () => resolve(source);
    img.src = (source instanceof Blob) ? URL.createObjectURL(source) : source;
  });
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
    setScan('מחדדים את התמונה...');
    source = await preprocessReceipt(source);
    setScan('טוענים את מנוע הקריאה (בפעם הראשונה לוקח כמה שניות)...');
    await loadTesseract();
    setScan('קוראים את הקבלה... כמה שניות והתוצאה אצלכם');
    const { data } = await window.Tesseract.recognize(source, 'heb+eng');
    window.__lastOcrText = data.text || '';
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
const RECEIPT_NOISE = ['קופה','סניף','אשרא','סהכ','סה"כ','תשלום','תודה','מזומן','עודף','מעמ','מע״מ','תאריך','שולם','חייב','זכאי','עסקה','כרטיס','שקל','הנחה','מחיר','סכום','יתרה','נקניה','קניה','סכה'];
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
function matchRuleLine(line, ltoks) {
  for (const rule of CATALOG.rules) {
    if (rule.tokens.some(t => t.length > 3 ? line.includes(t) : ltoks.includes(t))) return rule;
    // התאמה מטושטשת לשגיאות OCR: טוקן באורך 4+ עם התאמת רישית או מרחק עריכה 1
    for (const t of rule.tokens) {
      if (t.length < 4) continue;
      if (ltoks.some(l => l.length >= 4 && (l.startsWith(t) || (t.length >= 4 && l.startsWith(t.slice(0, 4))) || lev(l, t) <= 1))) return rule;
    }
  }
  return null;
}

function matchBarcode(line) {
  const runs = line.match(/\d{7,14}/g) || [];
  for (const run of runs) {
    for (const it of CATALOG.items) {
      const bc = it.barcode || '';
      if (!bc) continue;
      if (bc === run || (run.length >= 8 && bc.endsWith(run))) return it;
      if (run.length >= 11 && bc.startsWith(run)) return it;
      if (bc.length === run.length && bc.length >= 12 && lev(bc, run) <= 1) return it;
      if (run.length >= 9 && bc.length > run.length && lev(run, bc.slice(-run.length)) <= 1) return it;
    }
  }
  return null;
}
function linePrice(line) {
  const nums = (line.match(/\d{1,4}\.\d{2}/g) || []).map(parseFloat).filter(v => v > 0.05 && v < 2000);
  return nums.length ? Math.max(...nums) : null;
}
function receiptTotal(text) {
  const m = text.match(/סה.{0,3}כ[^\d]{0,10}([\d,]{2,7}\.\d{2})/);
  if (m) return parseFloat(m[1].replace(',', ''));
  return null;
}
function analyzeReceipt(text) {
  buildTokens();
  const total = receiptTotal(text);
  const lines = text.split('\n').map(rnorm).filter(l => l.replace(/[0-9 ]/g, '').length >= 3);
  const seen = {}; const unmatched = [];
  for (const line of lines) {
    if (RECEIPT_NOISE.some(w => line.includes(w))) continue;
    const ltoks = line.split(' ').filter(w => w.length >= 2);
    const item = matchCatalogLine(ltoks) || matchBarcode(line);
    if (item) {
      if (!seen[item.id]) seen[item.id] = { kind:'catalog', item, count:0 };
      seen[item.id].count++;
      const rp = linePrice(line);
      if (rp && !seen[item.id].receiptPrice) seen[item.id].receiptPrice = rp;
      continue;
    }
    const rule = matchRuleLine(line, ltoks);
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
  return { rated, unmatched, total };
}

/* ============ ערכים תזונתיים + דירוג חלופות (מחקר ספט׳ 2026) ============ */
/* ספי התווית האדומה של משרד הבריאות (2021) ל-100 גרם מוצק / 100 מ״ל נוזל:
   https://efsharibari.health.gov.il/en/governance/legislation/unhealthy-food-labeling-law/ */
const MOH_SOLID = { sugar: 10, sodium: 400, satfat: 4 };
const MOH_LIQUID = { sugar: 5, sodium: 300, satfat: 3 };
/* רמות מדד גליקמי לפי Diabetes UK */
const GI_BANDS = [[55, 'נמוך', 'g'], [69, 'בינוני', 'y'], [Infinity, 'גבוה', 'r']];
const TSP_G = 4.2; /* כפית סוכר ≈ 4.2 גרם */

function giBand(gi) { for (const [max, label, cls] of GI_BANDS) if (gi <= max) return { label, cls }; }
function giChipHtml(it) {
  if (!it.gi) return '';
  const b = giBand(it.gi);
  return `<span class="gi-chip ${b.cls}">מדד גליקמי ${b.label} (${it.gi})</span>`;
}
function isLiquidItem(it) { return /ליטר|מ״ל|מ"ל|משקה|מיץ|קולה|בירה|סודה|נקטר/.test(it.name_he || ''); }
function factsOf(it) {
  if (!NUTFACTS || !it) return null;
  return NUTFACTS[it.barcode] || NUTFACTS[it.id] || null;
}
function rnd1(v) { return Math.round(v * 10) / 10; }
function tspTxt(g) { const t = g / TSP_G; return t >= 10 ? String(Math.round(t)) : String(rnd1(t)); }

function mohFlagsHtml(f, liquid) {
  const th = liquid ? MOH_LIQUID : MOH_SOLID;
  const flags = [];
  if (f.sugars != null && f.sugars >= th.sugar) flags.push('גבוה בסוכר');
  if (f.sodium_mg != null && f.sodium_mg >= th.sodium) flags.push('גבוה בנתרן');
  if (f.satfat != null && f.satfat >= th.satfat) flags.push('גבוה בשומן רווי');
  const known = f.sugars != null || f.sodium_mg != null || f.satfat != null;
  if (!known) return '';
  if (!flags.length) return `<div class="moh"><span class="moh-chip ok">✔ ללא תווית אדומה בסוכר/נתרן/שומן רווי</span></div>`;
  return `<div class="moh">${flags.map(t => `<span class="moh-chip red">⚠ תווית אדומה: ${t}</span>`).join('')}<span class="moh-src">ספי משרד הבריאות ל-100 ${liquid ? 'מ״ל' : 'גרם'}</span></div>`;
}

function nutriStripHtml(it) {
  const f = factsOf(it);
  const gi = giChipHtml(it);
  if (!f) return gi ? `<div class="nutri"><div class="nutri-gi">${gi}</div></div>` : '';
  const liquid = isLiquidItem(it);
  const unit = liquid ? '100 מ״ל' : '100 גרם';
  const cells = [];
  if (f.sugars != null) cells.push(['סוכר', rnd1(f.sugars), f.sugars >= (liquid ? MOH_LIQUID.sugar : MOH_SOLID.sugar) ? 'r' : '']);
  if (f.c != null) cells.push(['פחמימות', rnd1(f.c), '']);
  if (f.p != null) cells.push(['חלבון', rnd1(f.p), '']);
  if (f.fiber != null) cells.push(['סיבים', rnd1(f.fiber), '']);
  if (f.f != null) cells.push(['שומן', rnd1(f.f), '']);
  if (f.satfat != null) cells.push(['שומן רווי', rnd1(f.satfat), f.satfat >= (liquid ? MOH_LIQUID.satfat : MOH_SOLID.satfat) ? 'r' : '']);
  if (f.sodium_mg != null) cells.push(['נתרן (מ״ג)', Math.round(f.sodium_mg), f.sodium_mg >= (liquid ? MOH_LIQUID.sodium : MOH_SOLID.sodium) ? 'r' : '']);
  if (!cells.length) return '';
  const grid = cells.map(([l, v, cls]) => `<div class="ncell ${cls}"><b>${v}</b><small>${l}</small></div>`).join('');
  let portion = '';
  if (it.portion_g && it.portion_g <= (liquid ? 1000 : 500) && f.sugars != null && f.sugars >= 5) {
    const ps = rnd1(f.sugars * it.portion_g / 100);
    if (ps >= 2) portion = `<div class="portion">ב${it.portion_label || 'אריזה'}: ${ps} גרם סוכר ≈ <b>${tspTxt(ps)} כפיות סוכר</b></div>`;
  }
  return `<div class="nutri">${gi ? `<div class="nutri-gi">${gi}</div>` : ''}<div class="ngrid">${grid}</div>${portion}${mohFlagsHtml(f, liquid)}<div class="nutri-src">ערכים ל-${unit} (Open Food Facts) · כפית סוכר ≈ 4.2 גרם</div></div>`;
}

/* דירוג חלופות: החלופה חייבת להשתפר מול המקור; הסדר לפי גודל השיפור.
   עקרונות: Fooducate (חלופה בציון גבוה יותר, אותה קטגוריה), Diabetes UK (GI + GL),
   שקיפות על טרייד-אוף. */
function swapAnalysis(it, s) {
  if (!s.ref || !CAT_BY_ID[s.ref] || s.ref === it.id) return null;
  const ref = CAT_BY_ID[s.ref];
  const of = factsOf(it), rf = factsOf(ref);
  const liquid = isLiquidItem(it);
  const unit = liquid ? '100 מ״ל' : '100 גרם';
  const pros = [], cons = [];
  let score = 0;
  if (of && rf) {
    if (of.sugars != null && rf.sugars != null) {
      const d = rnd1(of.sugars - rf.sugars);
      if (d >= 2) { pros.push(`פחות סוכר: ${rnd1(rf.sugars)} לעומת ${rnd1(of.sugars)} גרם ל-${unit}`); score += 3 * Math.min(d, 30) / 10; }
      else if (d <= -2) { cons.push(`דווקא יותר סוכר (+${Math.abs(d)} גרם)`); score -= 2; }
    }
    if (of.c != null && rf.c != null) {
      const d = rnd1(of.c - rf.c);
      if (d >= 5) { pros.push(`פחות פחמימות (−${d} גרם)`); score += Math.min(d, 30) / 15; }
    }
    if (of.fiber != null && rf.fiber != null && rf.fiber - of.fiber >= 2) { pros.push(`יותר סיבים (+${rnd1(rf.fiber - of.fiber)} גרם)`); score += 1; }
    if (of.p != null && rf.p != null) {
      const d = rnd1(rf.p - of.p);
      if (d >= 2) { pros.push(`יותר חלבון (+${d} גרם)`); score += 1; }
      else if (d <= -3) cons.push(`פחות חלבון (${Math.abs(d)}− גרם)`);
    }
  }
  if (it.gi && ref.gi && ref.gi < it.gi) { pros.push(`מדד גליקמי נמוך יותר (${ref.gi} לעומת ${it.gi})`); score += (it.gi - ref.gi) / 10; }
  const op = itemMinPrice(it.id), rp = itemMinPrice(ref.id);
  if (op != null && rp != null) {
    const d = op - rp;
    if (d >= 0.3) { pros.push(`זול יותר ב-₪${d.toFixed(2)}`); score += Math.min(d, 5) / 2; }
    else if (d <= -0.3) cons.push(`יקר יותר ב-₪${Math.abs(d).toFixed(2)}`);
  }
  const chains = PRICES[ref.id] ? Object.keys(PRICES[ref.id]).length : 0;
  if (chains >= 3) { pros.push(`זמין ב-${chains} רשתות`); score += 0.5; }
  return { pros, cons, score, rp };
}

function swapsBodyHtml(it) {
  const list = (it.swaps || []).map(s => ({ s, a: swapAnalysis(it, s) }));
  list.sort((x, y) => (y.a ? y.a.score : -1) - (x.a ? x.a.score : -1));
  return list.map(({ s, a }) => {
    const why = a && (a.pros.length || a.cons.length)
      ? `<div class="swap-why">${a.pros.map(p => `<span class="sw-pro">▲ ${p}</span>`).join('')}${a.cons.map(c => `<span class="sw-con">▼ ${c}</span>`).join('')}</div>`
      : `<div class="swap-why"><span class="sw-note">אין לנו נתוני תזונה מדויקים לחלופה הזו - כדאי לבדוק בתווית באריזה</span></div>`;
    const rp = a && a.rp != null ? `<div class="where">מחיר משוער: ${fmt(a.rp)}</div>` : '';
    return `<div class="swap-body">${s.img ? `<img class="pimg swap-img" src="${s.img}" alt="" loading="lazy" onerror="this.remove()">` : ''}
    <div class="swap-txt"><b>${s.name}</b>${why}
    <div class="where">איפה קונים: ${s.where}</div>${rp}</div></div>`;
  }).join('');
}

function ratingExplainerHtml() {
  return `<details class="how"><summary>איך אנחנו מדרגים ומציגים? (כללי המשחק והמקורות)</summary>
  <ul class="how-list">
    <li><b>חלופה</b> מוצגת רק כשהיא שיפור על המוצר שקניתם, ומדורגת לפי: פחות סוכר ופחמימות, מדד גליקמי נמוך יותר, יותר סיבים וחלבון, מחיר וזמינות ברשתות. אם משהו בחלופה פחות טוב - כתוב במפורש.</li>
    <li><b>ערכי תזונה</b> מוצגים ל-100 גרם/מ״ל - אותו בסיס כמו על האריזה, כדי שאפשר יהיה להשוות שני מוצרים - ובנוסף לפי גודל האריזה כשהוא ידוע.</li>
    <li><b>משפחות גבינות</b> (צהובה, לבנה, קוטג\', שמנת, בולגרית, צפתית, מוצרלה, פטה, חלומי) מדורגות לפי אחוז השומן: עד 15% ירוק, 16-24% צהוב, 25% ומעלה אדום.</li>
    <li><b>תווית אדומה</b> מוצגת לפי ספי משרד הבריאות: סוכר ≥10 גרם, נתרן ≥400 מ״ג, שומן רווי ≥4 גרם ל-100 גרם (בשתייה: 5 גרם / 300 מ״ג / 3 גרם ל-100 מ״ל).</li>
    <li><b>סוכר בכפיות</b> (כפית ≈ 4.2 גרם) - פורמט שהוכח במחקרים כקל להבנה במיוחד.</li>
    <li><b>מדד גליקמי</b>: נמוך עד 55, בינוני 56-69, גבוה 70+ (Diabetes UK). שימו לב: גודל המנה משפיע יותר מהמדד לבדו, ומדד נמוך לא תמיד אומר בריא.</li>
  </ul>
  <div class="how-links">מקורות:
    <a href="https://www.diabetes.org.uk/living-with-diabetes/eating/carbohydrates-and-diabetes/glycaemic-index-and-diabetes" target="_blank" rel="noopener">Diabetes UK - מדד גליקמי</a> ·
    <a href="https://efsharibari.health.gov.il/en/governance/legislation/unhealthy-food-labeling-law/" target="_blank" rel="noopener">משרד הבריאות - תוויות אדומות</a> ·
    <a href="https://www.diabetes.org.uk/living-with-diabetes/eating/healthy-swaps" target="_blank" rel="noopener">Diabetes UK - החלפות מומלצות</a> ·
    <a href="https://www.fooducate.com/faq" target="_blank" rel="noopener">Fooducate - איך בוחרים חלופות</a> ·
    <a href="https://bmcpublichealth.biomedcentral.com/articles/10.1186/s12889-022-13648-1" target="_blank" rel="noopener">מחקר: סוכר בכפיות</a>
  </div></details>`;
}

/* ============ תוצאות ============ */
const RATING_HE = { g:'ירוק', y:'צהוב', r:'אדום', n:'לא מזון' };
const RATING_ICON = { g:'✔', y:'!', r:'✖', n:'–' };
let lastResult = null;

function catalogCardHtml(it, receiptPrice) {
  const minP = itemMinPrice(it.id);
  const swaps = swapsBodyHtml(it);
  return `<div class="item">
    <div class="item-head"><div class="badge ${it.rating}">${RATING_ICON[it.rating]}</div>
      <div class="name">${it.name_he}${minP != null ? ` <span class="est">${fmt(minP)}</span>` : ''}${receiptPrice ? ` <span class="est">· בקבלה: ₪${receiptPrice.toFixed(2)}</span>` : ''}</div>
      ${it.img ? `<img class="pimg" src="${it.img}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>
    ${it.why ? `<div class="why">${it.why}</div>` : ''}
    ${nutriStripHtml(it)}
    ${swaps ? `<div class="swap"><div class="swap-title"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 8h13l-3-3M20 16H7l3 3" stroke="#1E7B34" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>החליפו בקנייה הבאה - הכי משפר ראשון:</div>${swaps}</div>` : ''}
  </div>`;
}

function renderResults(result) {
  lastResult = result;
  const counts = { g:0, y:0, r:0 };
  result.rated.forEach(x => { const rr = x.kind === 'catalog' ? x.item.rating : x.rule.rating; if (counts[rr] !== undefined) counts[rr]++; });
  const warn = $('scanQuality');
  if (warn) warn.innerHTML = result.unmatched.length > result.rated.length
    ? '<div class="quality-note">זיהינו רק חלק מהשורות בקבלה הזו (התמונה דהויה או מקומטת). לתוצאה מלאה: צלמו שוב באור טוב, בלי קפלים, ישר מעל הקבלה.</div>'
    : '';
  $('summaryChips').innerHTML =
    `<div class="chip g">${counts.g}<small>ירוק</small></div><div class="chip y">${counts.y}<small>צהוב</small></div><div class="chip r">${counts.r}<small>אדום</small></div>` +
    (result.total ? `<div class="chip total-chip"><small>סה״כ שזוהה בקבלה</small>₪${result.total.toFixed(2)}</div>` : '');

  const order = { r:0, y:1, g:2, n:3 };
  const sorted = [...result.rated].sort((a, b) => {
    const ra = a.kind === 'catalog' ? a.item.rating : a.rule.rating;
    const rb = b.kind === 'catalog' ? b.item.rating : b.rule.rating;
    return order[ra] - order[rb];
  });

  $('resultsList').innerHTML = sorted.map(x => {
    if (x.kind === 'catalog') return catalogCardHtml(x.item, x.receiptPrice);
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
    <p class="q-note">${q.note}</p>${ratingExplainerHtml()}`;
}

function swapMessage() {
  if (!lastResult) return '';
  const reds = lastResult.rated.filter(x => x.kind === 'catalog' && x.item.rating === 'r');
  const lines = ['סוכר בסל - ההחלפות שלי לקנייה הבאה:'];
  reds.forEach(x => {
    const ranked = x.item.swaps.map(s => ({ s, a: swapAnalysis(x.item, s) }))
      .sort((p, q) => (q.a ? q.a.score : -1) - (p.a ? p.a.score : -1));
    ranked.forEach(({ s, a }) => lines.push(`• במקום ${x.item.name_he}: ${s.name} (${s.where})${a && a.pros.length ? ' - ' + a.pros[0] : ''}`));
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

/* ============ חיפוש מוצר מהקטלוג המלא (בלי קבלה) ============ */
let lastSearchFound = [];

function searchCatalog(q) {
  buildTokens();
  const nq = rnorm(q);
  if (nq.replace(/[0-9 ]/g, '').length < 2) return [];
  const qtoks = nq.split(' ').filter(w => w.length >= 2 && !RSTOP.has(w) && !/^\d+$/.test(w));
  const scored = [];
  for (const it of CATALOG.items) {
    const name = rnorm(it.name_he);
    let score = 0;
    if (name.includes(nq)) score = 100 + (name.startsWith(nq) ? 20 : 0) - name.length / 100;
    else if (qtoks.length) {
      let cov = 0, exact = 0;
      for (const qt of qtoks) {
        const toks = ITOKENS[it.id] || [];
        if (toks.some(t => t === qt) || name.includes(qt)) { cov++; exact++; }
        else if (toks.some(t => tokMatch(t, qt))) cov++;
      }
      if (cov === qtoks.length) score = 50 + exact * 5 - name.length / 100;
    }
    if (score > 0) scored.push({ it, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map(x => x.it);
}

function searchRowsHtml(found) {
  return found.map(it => {
    const minP = itemMinPrice(it.id);
    return `<button class="search-row" data-id="${it.id}">
      <span class="badge ${it.rating}">${RATING_ICON[it.rating]}</span>
      <span class="sr-name">${it.name_he}</span>
      ${minP != null ? `<span class="est">${fmt(minP)}</span>` : ''}
    </button>`;
  }).join('');
}

function wireSearch() {
  const inp = $('searchInput');
  const showCard = it => {
    $('searchResults').innerHTML = '';
    $('searchHint').innerHTML = '<button class="search-back" id="btnBackToResults">‹ חזרה לתוצאות החיפוש</button>';
    $('searchCard').innerHTML = catalogCardHtml(it) + ratingExplainerHtml();
    $('btnBackToResults').onclick = () => { $('searchCard').innerHTML = ''; runSearch(); window.scrollTo(0, 0); };
    window.scrollTo(0, 0);
  };
  const bindRows = () => {
    $('searchResults').querySelectorAll('.search-row').forEach(b => {
      b.onclick = () => { const it = CAT_BY_ID[b.dataset.id]; if (it) showCard(it); };
    });
  };
  const runSearch = () => {
    const q = inp.value.trim();
    $('searchCard').innerHTML = '';
    if (rnorm(q).replace(/[0-9 ]/g, '').length < 2) {
      $('searchResults').innerHTML = '';
      $('searchHint').textContent = q ? 'כתבו לפחות שתי אותיות כדי לחפש' : '';
      return;
    }
    lastSearchFound = searchCatalog(q);
    $('searchHint').textContent = lastSearchFound.length
      ? (lastSearchFound.length === 12 ? '12 התוצאות הראשונות - לחצו על מוצר לצפייה מלאה' : `${lastSearchFound.length} תוצאות - לחצו על מוצר לצפייה מלאה`)
      : 'לא מצאנו את המוצר בקטלוג. נסו שם כללי יותר (למשל "לחם" או "גבינה").';
    $('searchResults').innerHTML = searchRowsHtml(lastSearchFound);
    bindRows();
  };
  inp.addEventListener('input', runSearch);
  inp.addEventListener('search', runSearch);
  $('btnHomeSearch').onclick = () => { history.replaceState(null, '', location.pathname); show('view-home'); };
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


/* ===== חיפוש מהבית: מעביר את השאילתה למסך החיפוש הקיים ===== */
document.addEventListener('DOMContentLoaded', () => {
  const forward = q => {
    location.hash = 'search';
    show('view-search');
    const s = $('searchInput');
    s.value = q;
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.focus();
  };
  document.querySelectorAll('[data-home-search]').forEach(inp => {
    inp.addEventListener('input', () => { if (inp.value.trim()) forward(inp.value); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); forward(inp.value); } });
  });
  document.querySelectorAll('[data-search-chip]').forEach(ch => {
    ch.addEventListener('click', () => forward(ch.dataset.searchChip));
  });
});
