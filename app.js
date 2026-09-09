import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.FAMILY_FINANCE_CONFIG || {};
const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.startsWith('YOUR_') && !cfg.SUPABASE_ANON_KEY.startsWith('YOUR_');
const supabase = configured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

const state = {
  user: null,
  month: null,
  categories: [],
  transactions: [],
  review: [],
  budgets: [],
  currentView: 'dashboard',
  chart: null,
  editingId: null,
};

const $ = (id) => document.getElementById(id);
const els = {
  configScreen: $('configScreen'), authScreen: $('authScreen'), appShell: $('appShell'),
  authForm: $('authForm'), authEmail: $('authEmail'), authPassword: $('authPassword'), authMessage: $('authMessage'),
  signUpButton: $('signUpButton'), signOutButton: $('signOutButton'), userEmail: $('userEmail'),
  monthPicker: $('monthPicker'), monthPickerWrap: $('monthPickerWrap'), viewTitle: $('viewTitle'), viewSubtitle: $('viewSubtitle'),
  dashboardView: $('dashboardView'), transactionsView: $('transactionsView'), reviewView: $('reviewView'), budgetView: $('budgetView'), importView: $('importView'),
  reviewBadge: $('reviewBadge'), toast: $('toast'), editDialog: $('editDialog'), editForm: $('editForm'),
  editMainCategory: $('editMainCategory'), editSubcategory: $('editSubcategory'), editTransactionSummary: $('editTransactionSummary'), rememberRule: $('rememberRule')
};

const fmtSEK = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const esc = (v='') => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 3200);
}
function setMessage(msg) { els.authMessage.textContent = msg || ''; }
function monthStart(month) { return `${month}-01`; }
function nextMonthStart(month) { const [y,m] = month.split('-').map(Number); const d = new Date(Date.UTC(y,m,1)); return d.toISOString().slice(0,10); }
function currentMonth() { return new Date().toISOString().slice(0,7); }
function normalizeDescription(value) {
  return String(value || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^A-Z0-9ÅÄÖ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
}
function excelDateToISO(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0,10);
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = String(value || '').trim();
  if (!s) return null;
  const direct = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]); if (y < 100) y += 2000;
    return `${y}-${String(dmy[2]).padStart(2,'0')}-${String(dmy[1]).padStart(2,'0')}`;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.valueOf()) ? null : dt.toISOString().slice(0,10);
}
function asNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null || v === '') return 0;
  const cleaned = String(v).replace(/\s/g,'').replace(/,/g,'.').replace(/[^0-9.+-]/g,'');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function findColumn(headers, names) {
  const norm = headers.map(h => String(h || '').trim().toLowerCase());
  for (const n of names) { const i = norm.indexOf(n.toLowerCase()); if (i >= 0) return i; }
  return -1;
}
function parseWorkbook(arrayBuffer, fileName) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  let selected = null;
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });
    const headerIndex = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c || '').trim().toLowerCase() === 'description'));
    if (headerIndex >= 0) { selected = { sheetName, rows, headerIndex }; if (sheetName.toLowerCase().includes('consolidated')) break; }
  }
  if (!selected) throw new Error('Could not find a row containing a Description column.');
  const { rows, headerIndex, sheetName } = selected;
  const headers = rows[headerIndex].map(v => String(v || '').trim());
  const idx = {
    description: findColumn(headers, ['Description','Text','Transaction description','Merchant']),
    account: findColumn(headers, ['Account','Konto']),
    main: findColumn(headers, ['Main Category','Category','Main category']),
    sub: findColumn(headers, ['Subcategory','Sub Category','Sub-category']),
    currency: findColumn(headers, ['FX','Currency']),
    debitSC: findColumn(headers, ['Debit (Statement Currency)']),
    creditSC: findColumn(headers, ['Credit (Statement Currency)']),
    debitLCY: findColumn(headers, ['Debit (LCY)','Debit']),
    creditLCY: findColumn(headers, ['Credit (LCY)','Credit']),
    amount: findColumn(headers, ['Amount','Belopp']),
    date: findColumn(headers, ['Date','Transaction date','Datum'])
  };
  if (idx.description < 0 || idx.date < 0) throw new Error('The file needs at least Description and Date columns.');
  const out = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const description = String(row[idx.description] ?? '').trim();
    const date = excelDateToISO(row[idx.date]);
    if (!description || !date) continue;
    let amount = 0;
    if (idx.creditSC >= 0 || idx.debitSC >= 0) amount = asNumber(row[idx.creditSC]) - asNumber(row[idx.debitSC]);
    else if (idx.creditLCY >= 0 || idx.debitLCY >= 0) amount = asNumber(row[idx.creditLCY]) - asNumber(row[idx.debitLCY]);
    else if (idx.amount >= 0) amount = asNumber(row[idx.amount]);
    const main = idx.main >= 0 ? String(row[idx.main] ?? '').trim() : '';
    const sub = idx.sub >= 0 ? String(row[idx.sub] ?? '').trim() : '';
    out.push({
      transaction_date: date,
      description,
      normalized_description: normalizeDescription(description),
      account: idx.account >= 0 ? String(row[idx.account] ?? '').trim() : '',
      currency: idx.currency >= 0 ? String(row[idx.currency] ?? 'SEK').trim() || 'SEK' : 'SEK',
      amount,
      main_category: main || null,
      subcategory: sub || null,
      classification_status: main ? 'historical' : 'needs_review',
      classification_confidence: main ? 1 : null,
      import_batch: `${fileName} / ${sheetName}`
    });
  }
  return { rows: out, sheetName, headers };
}

async function authInit() {
  if (!configured) { els.configScreen.classList.remove('hidden'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await enterApp(session.user); else els.authScreen.classList.remove('hidden');
  supabase.auth.onAuthStateChange(async (_event, session2) => {
    if (session2?.user && (!state.user || state.user.id !== session2.user.id)) await enterApp(session2.user);
    if (!session2) showAuth();
  });
}
function showAuth() {
  state.user = null;
  els.appShell.classList.add('hidden'); els.configScreen.classList.add('hidden'); els.authScreen.classList.remove('hidden');
}
async function enterApp(user) {
  state.user = user;
  els.authScreen.classList.add('hidden'); els.configScreen.classList.add('hidden'); els.appShell.classList.remove('hidden');
  els.userEmail.textContent = user.email || '';
  await refreshBaseData();
  if (!state.month) state.month = await determineLatestMonth();
  els.monthPicker.value = state.month;
  await switchView('dashboard');
}
async function determineLatestMonth() {
  const { data } = await supabase.from('transactions').select('transaction_date').order('transaction_date',{ascending:false}).limit(1);
  return data?.[0]?.transaction_date?.slice(0,7) || currentMonth();
}
async function refreshBaseData() {
  const [{data: cats}, {count}] = await Promise.all([
    supabase.from('categories').select('*').order('main_category').order('subcategory'),
    supabase.from('transactions').select('*',{count:'exact',head:true}).eq('classification_status','needs_review')
  ]);
  state.categories = cats || [];
  els.reviewBadge.textContent = count || 0;
  els.reviewBadge.classList.toggle('hidden', !count);
}
async function loadMonthData() {
  const from = monthStart(state.month), to = nextMonthStart(state.month);
  const [{data: tx, error:e1}, {data: budgets, error:e2}] = await Promise.all([
    supabase.from('transactions').select('*').gte('transaction_date',from).lt('transaction_date',to).order('transaction_date',{ascending:false}).limit(5000),
    supabase.from('budgets').select('*').eq('month',from)
  ]);
  if (e1) throw e1; if (e2) throw e2;
  state.transactions = tx || []; state.budgets = budgets || [];
}
async function loadReview() {
  const {data,error} = await supabase.from('transactions').select('*').eq('classification_status','needs_review').order('transaction_date',{ascending:false}).limit(1000);
  if (error) throw error; state.review = data || [];
}

function setViewMeta(title, subtitle='', showMonth=true) {
  els.viewTitle.textContent = title; els.viewSubtitle.textContent = subtitle; els.monthPickerWrap.classList.toggle('hidden', !showMonth);
}
async function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = $(`${view}View`); if (el) el.classList.remove('hidden');
  try {
    if (view === 'dashboard') { setViewMeta('Dashboard','Monthly family cash flow'); await loadMonthData(); renderDashboard(); }
    if (view === 'transactions') { setViewMeta('Transactions','Search and correct classifications'); await loadMonthData(); renderTransactions(); }
    if (view === 'review') { setViewMeta('Needs review','Only transactions the rule engine could not classify',false); await loadReview(); renderReview(); }
    if (view === 'budget') { setViewMeta('Budget','Monthly budgets by main category'); await loadMonthData(); renderBudget(); }
    if (view === 'import') { setViewMeta('Import','Drop in the historical workbook or a new bank export',false); renderImport(); }
  } catch(e) { console.error(e); toast(e.message || 'Something went wrong'); }
}

function renderDashboard() {
  const tx = state.transactions;
  const income = tx.filter(t => Number(t.amount)>0).reduce((a,t)=>a+Number(t.amount),0);
  const expense = -tx.filter(t => Number(t.amount)<0).reduce((a,t)=>a+Number(t.amount),0);
  const savings = income - expense;
  const rate = income ? savings / income : 0;
  const byCat = new Map();
  for (const t of tx) if (Number(t.amount) < 0) byCat.set(t.main_category || 'Unclassified', (byCat.get(t.main_category || 'Unclassified')||0) + -Number(t.amount));
  const categories = [...byCat.entries()].sort((a,b)=>b[1]-a[1]);
  const budgetTotal = state.budgets.reduce((a,b)=>a+Number(b.amount),0);
  const reviewCount = tx.filter(t=>t.classification_status==='needs_review').length;
  els.dashboardView.innerHTML = `
    <div class="kpi-grid">
      <div class="card"><div class="kpi-label">Income</div><div class="kpi-value positive">${fmtSEK.format(income)}</div></div>
      <div class="card"><div class="kpi-label">Expenses</div><div class="kpi-value">${fmtSEK.format(expense)}</div><div class="kpi-sub">${budgetTotal ? `${Math.round(expense/budgetTotal*100)}% of budget` : 'No budget set'}</div></div>
      <div class="card"><div class="kpi-label">Savings</div><div class="kpi-value ${savings>=0?'positive':'negative'}">${fmtSEK.format(savings)}</div><div class="kpi-sub">${(rate*100).toFixed(1)}% savings rate</div></div>
      <div class="card"><div class="kpi-label">Needs review</div><div class="kpi-value">${reviewCount}</div><div class="kpi-sub">this month</div></div>
    </div>
    <div class="content-grid">
      <div class="card"><h2>Spending by category</h2><div class="chart-wrap"><canvas id="categoryChart"></canvas></div></div>
      <div class="card"><h2>Largest categories</h2><div class="category-list">${categories.slice(0,10).map(([c,v]) => {
        const max = categories[0]?.[1] || 1; return `<div class="category-item"><div><strong>${esc(c)}</strong><div class="bar"><div style="width:${Math.max(2,v/max*100)}%"></div></div></div><div>${fmtSEK.format(v)}</div><div class="muted">${expense?Math.round(v/expense*100):0}%</div></div>`;
      }).join('') || '<div class="empty">No expenses for this month.</div>'}</div></div>
    </div>`;
  if (state.chart) state.chart.destroy();
  const canvas = $('categoryChart');
  if (canvas && categories.length) state.chart = new Chart(canvas, { type:'doughnut', data:{ labels:categories.slice(0,10).map(x=>x[0]), datasets:[{data:categories.slice(0,10).map(x=>x[1])}] }, options:{maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}} });
}
function transactionTable(rows, includeActions=true) {
  if (!rows.length) return '<div class="empty">No transactions found.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Category</th><th>Subcategory</th><th>Amount</th>${includeActions?'<th></th>':''}</tr></thead><tbody>${rows.map(t=>`<tr>
    <td>${esc(t.transaction_date)}</td><td class="description" title="${esc(t.description)}">${esc(t.description)}</td><td>${esc(t.account)}</td><td>${esc(t.main_category || '—')}</td><td>${esc(t.subcategory || '—')}</td><td class="amount ${Number(t.amount)<0?'negative':'positive'}">${fmtSEK.format(Number(t.amount))}</td>${includeActions?`<td class="row-actions"><button data-edit="${t.id}">Edit</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function renderTransactions() {
  const mainCats = [...new Set(state.categories.map(c=>c.main_category))];
  els.transactionsView.innerHTML = `<div class="filters"><input id="txSearch" placeholder="Search description…"><select id="txCategory"><option value="">All categories</option>${mainCats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select id="txStatus"><option value="">All statuses</option><option value="needs_review">Needs review</option><option value="auto">Auto</option><option value="manual">Manual</option><option value="historical">Historical</option></select></div><div id="txTable">${transactionTable(state.transactions)}</div>`;
  const rerender = () => {
    const q = $('txSearch').value.toLowerCase(), cat = $('txCategory').value, st = $('txStatus').value;
    const rows = state.transactions.filter(t => (!q || t.description.toLowerCase().includes(q)) && (!cat || t.main_category===cat) && (!st || t.classification_status===st));
    $('txTable').innerHTML = transactionTable(rows);
    bindEditButtons();
  };
  ['txSearch','txCategory','txStatus'].forEach(id => $(id).addEventListener('input',rerender));
  bindEditButtons();
}
function renderReview() {
  els.reviewView.innerHTML = `<div class="hint">These are the only rows that need a decision. Once corrected, the app can remember that description for future imports.</div><div style="height:12px"></div>${transactionTable(state.review)}`;
  bindEditButtons();
}
function renderBudget() {
  const spend = new Map();
  for (const t of state.transactions) if (Number(t.amount)<0 && t.main_category) spend.set(t.main_category,(spend.get(t.main_category)||0)+-Number(t.amount));
  const mainCats = [...new Set(state.categories.map(c=>c.main_category))].filter(Boolean).sort();
  const bmap = new Map(state.budgets.map(b=>[b.main_category,Number(b.amount)]));
  els.budgetView.innerHTML = `<div class="card"><h2>${esc(state.month)} budget</h2><div id="budgetRows">${mainCats.map(c=>{
    const actual=spend.get(c)||0,budget=bmap.get(c)||0,pct=budget?Math.min(100,actual/budget*100):0;
    return `<div class="budget-row"><strong>${esc(c)}</strong><input type="number" min="0" step="100" data-budget-cat="${esc(c)}" value="${budget||''}" placeholder="0"><div>${fmtSEK.format(actual)}</div><div class="progress"><div style="width:${pct}%"></div></div><div class="small muted">${budget?Math.round(actual/budget*100)+'%':'—'}</div></div>`;
  }).join('') || '<div class="empty">Import classified history first to create categories.</div>'}</div><div style="margin-top:16px"><button id="saveBudgets" class="primary">Save budget</button></div></div>`;
  $('saveBudgets')?.addEventListener('click',saveBudgets);
}
async function saveBudgets() {
  const rows = [...document.querySelectorAll('[data-budget-cat]')].map(i=>({owner_id:state.user.id,month:monthStart(state.month),main_category:i.dataset.budgetCat,amount:asNumber(i.value),updated_at:new Date().toISOString()}));
  const {error} = await supabase.from('budgets').upsert(rows,{onConflict:'owner_id,month,main_category'}); if (error) return toast(error.message); toast('Budget saved'); await switchView('budget');
}
function renderImport() {
  els.importView.innerHTML = `<div class="card"><h2>Import transactions</h2><p class="muted">For the first import, use your consolidated historical XLSM file. Existing categories in that file are preserved and used to build the rule engine.</p><div id="dropZone" class="import-drop"><strong>Drop XLSX, XLSM or CSV here</strong><p class="muted">or</p><input id="filePicker" type="file" accept=".xlsx,.xlsm,.xls,.csv" /></div><div id="importStatus" class="import-status hidden"></div></div>`;
  const dz=$('dropZone'), picker=$('filePicker');
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));
  dz.addEventListener('drop',e=>{const f=e.dataTransfer.files?.[0];if(f) importFile(f)});
  picker.addEventListener('change',e=>{const f=e.target.files?.[0];if(f) importFile(f)});
}
function setImportStatus(msg) { const s=$('importStatus'); if (!s) return; s.classList.remove('hidden'); s.textContent=msg; }

function buildHistoricalRuleCandidates(rows) {
  const buckets = new Map();
  const add=(type,key,row)=>{
    if(!key || !row.main_category) return;
    const bkey=`${type}\u0000${key}`;
    if(!buckets.has(bkey)) buckets.set(bkey,{type,key,total:0,counts:new Map()});
    const b=buckets.get(bkey); b.total++;
    const ck=`${row.main_category}\u0000${row.subcategory||''}`; b.counts.set(ck,(b.counts.get(ck)||0)+1);
  };
  for(const r of rows.filter(x=>x.main_category)) { add('exact',r.description.trim().toUpperCase(),r); add('normalized',r.normalized_description,r); }
  const result=[];
  for(const b of buckets.values()) {
    const [winner,count]=[...b.counts.entries()].sort((a,c)=>c[1]-a[1])[0];
    const [main,sub]=winner.split('\u0000'); const confidence=count/b.total;
    const threshold=b.type==='exact' ? (b.total>=2 && confidence>=0.95) : (b.total>=3 && confidence>=0.97);
    result.push({match_type:b.type,match_value:b.key,main_category:main,subcategory:sub,historical_count:b.total,confidence,source:'historical',auto_apply:threshold});
  }
  return result;
}
async function fetchRulesMap() {
  const all=[]; let from=0; const page=1000;
  while(true) {
    const {data,error}=await supabase.from('classification_rules').select('*').range(from,from+page-1);
    if(error) throw error; all.push(...(data||[])); if(!data || data.length<page) break; from+=page;
  }
  const exact=new Map(), normalized=new Map();
  for(const r of all) if(r.auto_apply) (r.match_type==='exact'?exact:normalized).set(r.match_value,r);
  return {exact,normalized};
}
async function classifyUnlabelled(rows) {
  const maps=await fetchRulesMap();
  for(const r of rows) {
    if(r.main_category) continue;
    const exact=maps.exact.get(r.description.trim().toUpperCase()); const norm=maps.normalized.get(r.normalized_description); const rule=exact||norm;
    if(rule) { r.main_category=rule.main_category; r.subcategory=rule.subcategory||null; r.classification_status='auto'; r.classification_confidence=Number(rule.confidence); }
  }
}
async function bulkUpsert(table, rows, onConflict, chunk=500) {
  let done=0;
  for(let i=0;i<rows.length;i+=chunk) {
    const part=rows.slice(i,i+chunk); const {error}=await supabase.from(table).upsert(part,{onConflict,ignoreDuplicates:true}); if(error) throw error; done+=part.length;
    setImportStatus(`Working… ${done.toLocaleString('sv-SE')} / ${rows.length.toLocaleString('sv-SE')}`);
  }
}
async function importFile(file) {
  try {
    setImportStatus('Reading file…');
    const buf=await file.arrayBuffer(); const parsed=parseWorkbook(buf,file.name); let rows=parsed.rows;
    if(!rows.length) throw new Error('No transaction rows found.');
    setImportStatus(`Found ${rows.length.toLocaleString('sv-SE')} transactions on sheet “${parsed.sheetName}”.\nClassifying new rows…`);
    await classifyUnlabelled(rows);
    setImportStatus(`Preparing ${rows.length.toLocaleString('sv-SE')} rows…`);
    for(let i=0;i<rows.length;i++) {
      const r=rows[i]; r.owner_id=state.user.id;
      r.fingerprint=await sha256([r.transaction_date,r.account,r.description,r.amount].join('|'));
    }
    setImportStatus('Uploading transactions…');
    await bulkUpsert('transactions',rows,'owner_id,fingerprint',400);

    const labelled=rows.filter(r=>r.main_category && r.classification_status==='historical');
    if(labelled.length) {
      setImportStatus('Building category index…');
      const catMap=new Map(); for(const r of labelled) catMap.set(`${r.main_category}\u0000${r.subcategory||''}`,{owner_id:state.user.id,main_category:r.main_category,subcategory:r.subcategory||''});
      await bulkUpsert('categories',[...catMap.values()],'owner_id,main_category,subcategory',500);
      setImportStatus('Building historical classification rules…');
      const rules=buildHistoricalRuleCandidates(labelled).map(r=>({...r,owner_id:state.user.id,updated_at:new Date().toISOString()}));
      await bulkUpsert('classification_rules',rules,'owner_id,match_type,match_value',400);
    }
    await refreshBaseData(); state.month=await determineLatestMonth(); els.monthPicker.value=state.month;
    const auto=rows.filter(r=>r.classification_status==='auto').length, review=rows.filter(r=>r.classification_status==='needs_review').length, hist=rows.filter(r=>r.classification_status==='historical').length;
    setImportStatus(`Import complete.\n${hist.toLocaleString('sv-SE')} historical classified rows\n${auto.toLocaleString('sv-SE')} automatically classified rows\n${review.toLocaleString('sv-SE')} rows need review`);
    toast('Import complete');
  } catch(e) { console.error(e); setImportStatus(`Import failed: ${e.message}`); }
}

function bindEditButtons() { document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.edit))); }
async function openEdit(id) {
  let t=state.transactions.find(x=>x.id===id) || state.review.find(x=>x.id===id);
  if(!t){const {data}=await supabase.from('transactions').select('*').eq('id',id).single();t=data;}
  if(!t) return; state.editingId=id;
  els.editTransactionSummary.innerHTML=`<strong>${esc(t.description)}</strong><br>${esc(t.transaction_date)} · ${fmtSEK.format(Number(t.amount))}`;
  const mainCats=[...new Set(state.categories.map(c=>c.main_category))].sort();
  els.editMainCategory.innerHTML=`<option value="">Choose…</option>${mainCats.map(c=>`<option ${c===t.main_category?'selected':''}>${esc(c)}</option>`).join('')}`;
  populateSubcategories(t.main_category,t.subcategory);
  els.rememberRule.checked=true; els.editDialog.showModal();
}
function populateSubcategories(main, selected='') {
  const subs=[...new Set(state.categories.filter(c=>c.main_category===main).map(c=>c.subcategory).filter(Boolean))].sort();
  els.editSubcategory.innerHTML=`<option value="">None</option>${subs.map(s=>`<option ${s===selected?'selected':''}>${esc(s)}</option>`).join('')}`;
}
async function saveEdit(e) {
  e.preventDefault(); if(!state.editingId) return;
  const main=els.editMainCategory.value, sub=els.editSubcategory.value; if(!main) return toast('Choose a category');
  const {data:t,error:fetchErr}=await supabase.from('transactions').select('*').eq('id',state.editingId).single(); if(fetchErr) return toast(fetchErr.message);
  const {error}=await supabase.from('transactions').update({main_category:main,subcategory:sub||null,classification_status:'manual',classification_confidence:1}).eq('id',state.editingId); if(error) return toast(error.message);
  await supabase.from('categories').upsert({owner_id:state.user.id,main_category:main,subcategory:sub||''},{onConflict:'owner_id,main_category,subcategory'});
  if(els.rememberRule.checked) {
    const now=new Date().toISOString();
    const rules=[
      {owner_id:state.user.id,match_type:'exact',match_value:t.description.trim().toUpperCase(),main_category:main,subcategory:sub||'',historical_count:1,confidence:1,source:'manual',auto_apply:true,updated_at:now},
      {owner_id:state.user.id,match_type:'normalized',match_value:t.normalized_description||normalizeDescription(t.description),main_category:main,subcategory:sub||'',historical_count:1,confidence:1,source:'manual',auto_apply:true,updated_at:now}
    ];
    await supabase.from('classification_rules').upsert(rules,{onConflict:'owner_id,match_type,match_value'});
  }
  els.editDialog.close(); state.editingId=null; await refreshBaseData(); toast('Classification saved'); await switchView(state.currentView);
}

els.authForm?.addEventListener('submit',async e=>{e.preventDefault();setMessage('Signing in…');const {error}=await supabase.auth.signInWithPassword({email:els.authEmail.value,password:els.authPassword.value});setMessage(error?.message||'');});
els.signUpButton?.addEventListener('click',async()=>{setMessage('Creating account…');const {data,error}=await supabase.auth.signUp({email:els.authEmail.value,password:els.authPassword.value});setMessage(error?.message || (data.session?'Account created.':'Account created. If email confirmation is enabled, confirm the email and then sign in.'));});
els.signOutButton?.addEventListener('click',()=>supabase.auth.signOut());
els.monthPicker?.addEventListener('change',async()=>{state.month=els.monthPicker.value;await switchView(state.currentView);});
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
els.editMainCategory?.addEventListener('change',()=>populateSubcategories(els.editMainCategory.value));
els.editForm?.addEventListener('submit',saveEdit);
$('cancelEditButton')?.addEventListener('click',()=>{ els.editDialog.close(); state.editingId=null; });

await authInit();
