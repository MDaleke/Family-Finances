import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.FAMILY_FINANCE_CONFIG || {};
const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.startsWith('YOUR_') && !cfg.SUPABASE_ANON_KEY.startsWith('YOUR_');
const supabase = configured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

const state = {
  user: null,
  month: null,
  categories: [],
  categorySettings: [],
  categorySettingsMap: new Map(),
  transactions: [],
  allTransactions: null,
  review: [],
  budgets: [],
  balanceItems: [],
  balanceValues: [],
  currentView: 'dashboard',
  charts: [],
  pnlPeriod: 'ttm',
  exploreHorizon: '36',
  balanceDate: new Date().toISOString().slice(0,10),
  editingId: null,
  preferences: defaultPreferences(),
};

const $ = (id) => document.getElementById(id);
const els = {
  configScreen: $('configScreen'), authScreen: $('authScreen'), appShell: $('appShell'),
  authForm: $('authForm'), authEmail: $('authEmail'), authPassword: $('authPassword'), authMessage: $('authMessage'),
  signUpButton: $('signUpButton'), signOutButton: $('signOutButton'), userEmail: $('userEmail'),
  monthPicker: $('monthPicker'), monthPickerWrap: $('monthPickerWrap'), viewTitle: $('viewTitle'), viewSubtitle: $('viewSubtitle'), viewEyebrow: $('viewEyebrow'),
  dashboardView: $('dashboardView'), incomeView: $('incomeView'), balanceView: $('balanceView'), exploreView: $('exploreView'),
  transactionsView: $('transactionsView'), reviewView: $('reviewView'), budgetView: $('budgetView'), importView: $('importView'), settingsView: $('settingsView'),
  reviewBadge: $('reviewBadge'), toast: $('toast'), editDialog: $('editDialog'), editForm: $('editForm'),
  editMainCategory: $('editMainCategory'), editSubcategory: $('editSubcategory'), editTransactionSummary: $('editTransactionSummary'), rememberRule: $('rememberRule')
};

const fmtSEK = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const fmtPct = (v, d=1) => Number.isFinite(v) ? `${(v*100).toFixed(d)}%` : '—';
const esc = (v='') => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const PALETTE = ['#2563eb','#0f766e','#7c3aed','#d97706','#db2777','#0891b2','#65a30d','#ea580c','#475569','#9333ea','#0284c7','#be123c'];
const PLOT_LAYOUT = { paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', font:{family:'Inter, ui-sans-serif, system-ui',color:'#334155'}, margin:{l:45,r:20,t:15,b:42} };

const FEATURE_CATALOG = [
  {id:'dashboard',label:'Overview',description:'Executive household CFO dashboard'},
  {id:'income',label:'Income Statement',description:'P&L, cash conversion and period comparisons'},
  {id:'balance',label:'Balance Sheet',description:'Assets, liabilities, liquidity and net worth'},
  {id:'explore',label:'Explore',description:'Long- and short-horizon analytics'},
  {id:'transactions',label:'Transactions',description:'Search and edit transaction history'},
  {id:'review',label:'Needs review',description:'Classification exception workflow'},
  {id:'budget',label:'Budget',description:'Plan vs actual and run-rate'},
  {id:'import',label:'Import',description:'Import new bank/card files'}
];
const DASHBOARD_WIDGETS = [
  {id:'kpis',label:'Executive KPI strip'},
  {id:'cash_trend',label:'12-month cash conversion trend'},
  {id:'waterfall',label:'Monthly cash waterfall'},
  {id:'spend_map',label:'Spending treemap'},
  {id:'insights',label:'Decision signals'},
  {id:'categories',label:'Largest categories'},
  {id:'budget_pulse',label:'Budget pulse'}
];
const EXPLORE_WIDGETS = [
  {id:'kpis',label:'Explore KPI strip'},
  {id:'trajectory',label:'Rolling spend trajectory'},
  {id:'category_evolution',label:'Category evolution'},
  {id:'seasonality',label:'Seasonality heatmap'},
  {id:'treemap',label:'Category / subcategory treemap'},
  {id:'merchants',label:'Merchant concentration'},
  {id:'momentum',label:'Category momentum'},
  {id:'weekday',label:'Weekday behaviour'},
  {id:'signals',label:'Interpretation signals'},
  {id:'annual_pnl',label:'Year-by-year household P&L'}
];
function defaultPreferences(){return {feature_flags:Object.fromEntries(FEATURE_CATALOG.map(x=>[x.id,true])),dashboard_widgets:Object.fromEntries(DASHBOARD_WIDGETS.map(x=>[x.id,true])),explore_widgets:Object.fromEntries(EXPLORE_WIDGETS.map(x=>[x.id,true]))};}
function prefEnabled(group,id){const defaults=defaultPreferences()[group]||{};const bucket=state.preferences?.[group]||{};return bucket[id] ?? defaults[id] ?? true;}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 3500);
}
function setMessage(msg) { els.authMessage.textContent = msg || ''; }
function currentMonth() { return new Date().toISOString().slice(0,7); }
function monthStart(month) { return `${month}-01`; }
function addMonths(dateStr, n) {
  const [y,m,d=1] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y,m-1+n,d));
  return dt.toISOString().slice(0,10);
}
function nextMonthStart(month) { return addMonths(monthStart(month),1); }
function addYears(dateStr,n) { const [y,m,d]=dateStr.split('-').map(Number); return `${y+n}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function monthLabel(ym) { const [y,m]=ym.split('-').map(Number); return new Intl.DateTimeFormat('en-GB',{month:'short',year:'2-digit'}).format(new Date(Date.UTC(y,m-1,1))); }
function daysInMonth(ym) { const [y,m]=ym.split('-').map(Number); return new Date(Date.UTC(y,m,0)).getUTCDate(); }
function normalizeDescription(value) {
  return String(value || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ').replace(/\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ').replace(/[^A-Z0-9ÅÄÖ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function merchantKey(value) {
  return normalizeDescription(value)
    .replace(/\b(AB|AS|LTD|LIMITED|INC|LLC|BV|GMBH|OY|WWW|COM|SE)\b/g,' ')
    .replace(/\b\d{1,3}\b/g,' ').replace(/\s+/g,' ').trim() || normalizeDescription(value);
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
  const s = String(value || '').trim(); if (!s) return null;
  const direct = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) { let y=Number(dmy[3]); if(y<100)y+=2000; return `${y}-${String(dmy[2]).padStart(2,'0')}-${String(dmy[1]).padStart(2,'0')}`; }
  const dt = new Date(s); return Number.isNaN(dt.valueOf()) ? null : dt.toISOString().slice(0,10);
}
function asNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null || v === '') return 0;
  const s=String(v).trim();
  const commaDecimal = /,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s);
  const cleaned = commaDecimal ? s.replace(/[\s.]/g,'').replace(',','.') : s.replace(/[\s,]/g,'');
  const n = Number(cleaned.replace(/[^0-9.+-]/g,'')); return Number.isFinite(n) ? n : 0;
}
function findColumn(headers,names) { const norm=headers.map(h=>String(h||'').trim().toLowerCase()); for(const n of names){const i=norm.indexOf(n.toLowerCase()); if(i>=0)return i;} return -1; }
function percentileRank(arr,x) { if(!arr.length)return NaN; return arr.filter(v=>v<=x).length/arr.length; }
function pctChange(a,b) { return b ? (a-b)/Math.abs(b) : NaN; }
function sum(rows,fn) { return rows.reduce((a,t)=>a+(Number(fn(t))||0),0); }
function inRange(t,start,end) { return t.transaction_date>=start && t.transaction_date<end; }
function rowsBetween(rows,start,end) { return rows.filter(t=>inRange(t,start,end)); }
function destroyCharts() { state.charts.forEach(c=>{try{c.destroy();}catch{}}); state.charts=[]; }
function chart(id,config) { const el=$(id); if(!el)return null; const c=new Chart(el,config); state.charts.push(c); return c; }
function plot(id,data,layout={},config={}) { if(!window.Plotly || !$(id))return; Plotly.newPlot(id,data,{...PLOT_LAYOUT,...layout},{displayModeBar:false,responsive:true,...config}); }

function defaultMeta(main,sub='') {
  const m=String(main||'').trim(), s=String(sub||'').trim();
  if (!m || ['#N/A','.','0'].includes(m)) return {treatment:'exclude',profile:'neutral'};
  if (m==='Transfers' || m==='Re_distribute') return {treatment:'transfer',profile:'neutral'};
  if (m==='Extraordinary') return {treatment:'extraordinary',profile:'neutral'};
  if (m==='Reimbursable_Business_Expense') return {treatment:'reimbursable_expense',profile:'neutral'};
  if (m==='Income' && s==='Reimbursement') return {treatment:'reimbursement_income',profile:'neutral'};
  if (m==='Income' && s==='Student Loan') return {treatment:'transfer',profile:'neutral'};
  if (m==='Income') return {treatment:'income',profile:'neutral'};
  if (m==='Financial_Expenses' || m==='Fees') return {treatment:'financial_expense',profile:'essential'};
  if (['Living','Insurance','Communication','Children','Health_Fitness','Pets','Education','Services'].includes(m)) return {treatment:'operating_expense',profile:'essential'};
  if (['Restaurants','Entertainment','Home_Entertainment','Retail','Sport_Activities','Travel','Philantrophy'].includes(m)) return {treatment:'operating_expense',profile:'discretionary'};
  return {treatment:'operating_expense',profile:'semi_discretionary'};
}
function settingsKey(main,sub='') { return `${main||''}\u0000${sub||''}`; }
function metaFor(t) {
  const exact=state.categorySettingsMap.get(settingsKey(t.main_category,t.subcategory||''));
  const main=state.categorySettingsMap.get(settingsKey(t.main_category,''));
  return exact || main || defaultMeta(t.main_category,t.subcategory);
}
function treatment(t) { return metaFor(t).treatment; }
function expenseValue(t) { return -Number(t.amount||0); }
function txMetric(t) {
  const tr=treatment(t), a=Number(t.amount||0);
  if(tr==='income' || tr==='reimbursement_income') return a;
  if(['operating_expense','financial_expense','extraordinary','reimbursable_expense'].includes(tr)) return -a;
  return 0;
}
function summarize(rows) {
  let coreIncome=0, operating=0, financial=0, extraordinary=0, reimbExpense=0, reimbIncome=0, transfers=0, excluded=0;
  for(const t of rows){ const a=Number(t.amount||0), tr=treatment(t);
    if(tr==='income') coreIncome+=a;
    else if(tr==='operating_expense') operating-=a;
    else if(tr==='financial_expense') financial-=a;
    else if(tr==='extraordinary') extraordinary-=a;
    else if(tr==='reimbursable_expense') reimbExpense-=a;
    else if(tr==='reimbursement_income') reimbIncome+=a;
    else if(tr==='transfer') transfers+=a;
    else excluded+=a;
  }
  const coreOutflow=operating+financial;
  const coreSurplus=coreIncome-coreOutflow;
  const reimbNet=reimbIncome-reimbExpense;
  const netCashSurplus=coreSurplus+reimbNet-extraordinary;
  return {coreIncome,operating,financial,coreOutflow,coreSurplus,extraordinary,reimbExpense,reimbIncome,reimbNet,netCashSurplus,transfers,excluded,savingsRate:coreIncome?coreSurplus/coreIncome:NaN};
}

function periodBounds(kind, month) {
  const end=nextMonthStart(month), y=Number(month.slice(0,4));
  if(kind==='month'){const start=monthStart(month); return {start,end,prevStart:addMonths(start,-1),prevEnd:start,label:monthLabel(month)};}
  if(kind==='ytd'){const start=`${y}-01-01`,prevStart=`${y-1}-01-01`,prevEnd=addYears(end,-1); return {start,end,prevStart,prevEnd,label:`YTD ${y}`};}
  if(kind==='year'){const start=`${y}-01-01`,yearEnd=`${y+1}-01-01`; return {start,end:yearEnd,prevStart:`${y-1}-01-01`,prevEnd:start,label:String(y)};}
  const start=addMonths(end,-12),prevStart=addMonths(start,-12); return {start,end,prevStart,prevEnd:start,label:`TTM to ${monthLabel(month)}`};
}
function monthKeys(start,end) { const out=[]; let cur=start.slice(0,7); while(monthStart(cur)<end){out.push(cur);cur=addMonths(monthStart(cur),1).slice(0,7);} return out; }
function monthsBack(endMonth,n) { const end=nextMonthStart(endMonth); return {start:addMonths(end,-n),end}; }

function parseWorkbook(arrayBuffer,fileName) {
  const wb=XLSX.read(arrayBuffer,{type:'array',cellDates:true}); let selected=null;
  for(const sheetName of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:true});
    const headerIndex=rows.findIndex(r=>Array.isArray(r)&&r.some(c=>String(c||'').trim().toLowerCase()==='description'));
    if(headerIndex>=0){selected={sheetName,rows,headerIndex};if(sheetName.toLowerCase().includes('consolidated'))break;}
  }
  if(!selected)throw new Error('Could not find a row containing a Description column.');
  const {rows,headerIndex,sheetName}=selected, headers=rows[headerIndex].map(v=>String(v||'').trim());
  const idx={
    description:findColumn(headers,['Description','Text','Transaction description','Merchant']), account:findColumn(headers,['Account','Konto']),
    main:findColumn(headers,['Main Category','Category','Main category']), sub:findColumn(headers,['Subcategory','Sub Category','Sub-category']),
    currency:findColumn(headers,['FX','Currency']), debitSC:findColumn(headers,['Debit (Statement Currency)']), creditSC:findColumn(headers,['Credit (Statement Currency)']),
    debitLCY:findColumn(headers,['Debit (LCY)','Debit']), creditLCY:findColumn(headers,['Credit (LCY)','Credit']), amount:findColumn(headers,['Amount','Belopp']), date:findColumn(headers,['Date','Transaction date','Datum'])
  };
  if(idx.description<0||idx.date<0)throw new Error('The file needs at least Description and Date columns.');
  const dataRows=rows.slice(headerIndex+1);
  const debitIdx=idx.debitSC>=0?idx.debitSC:idx.debitLCY;
  const debitSample=debitIdx>=0?dataRows.map(r=>asNumber(r[debitIdx])).filter(v=>v!==0).slice(0,500):[];
  const debitNegative=debitSample.length ? debitSample.filter(v=>v<0).length/debitSample.length>0.7 : false;
  const out=[]; const occurrence=new Map();
  for(const row of dataRows){
    const description=String(row[idx.description]??'').trim(), date=excelDateToISO(row[idx.date]); if(!description||!date)continue;
    let amount=0;
    if(idx.creditSC>=0||idx.debitSC>=0){const c=asNumber(row[idx.creditSC]),d=asNumber(row[idx.debitSC]);amount=debitNegative?c+d:c-d;}
    else if(idx.creditLCY>=0||idx.debitLCY>=0){const c=asNumber(row[idx.creditLCY]),d=asNumber(row[idx.debitLCY]);amount=debitNegative?c+d:c-d;}
    else if(idx.amount>=0)amount=asNumber(row[idx.amount]);
    const main=idx.main>=0?String(row[idx.main]??'').trim():'', sub=idx.sub>=0?String(row[idx.sub]??'').trim():'';
    if(Math.abs(amount)<0.000001 && /balance brought forward/i.test(description))continue;
    const acc=idx.account>=0?String(row[idx.account]??'').trim():'';
    const base=[date,acc,description,amount.toFixed(4)].join('|'); const ord=occurrence.get(base)||0; occurrence.set(base,ord+1);
    out.push({transaction_date:date,description,normalized_description:normalizeDescription(description),account:acc,
      currency:idx.currency>=0?String(row[idx.currency]??'SEK').trim()||'SEK':'SEK',amount,main_category:main||null,subcategory:sub||null,
      classification_status:main?'historical':'needs_review',classification_confidence:main?1:null,import_batch:`${fileName} / ${sheetName}`,fingerprint_seed:`${base}|${ord}`});
  }
  return {rows:out,sheetName,headers,debitNegative};
}

async function authInit(){
  if(!configured){els.configScreen.classList.remove('hidden');return;}
  const {data:{session}}=await supabase.auth.getSession();
  if(session?.user)await enterApp(session.user);else els.authScreen.classList.remove('hidden');
  supabase.auth.onAuthStateChange(async(_event,s)=>{if(s?.user&&(!state.user||state.user.id!==s.user.id))await enterApp(s.user);if(!s)showAuth();});
}
function showAuth(){state.user=null;els.appShell.classList.add('hidden');els.configScreen.classList.add('hidden');els.authScreen.classList.remove('hidden');}
async function enterApp(user){
  state.user=user;els.authScreen.classList.add('hidden');els.configScreen.classList.add('hidden');els.appShell.classList.remove('hidden');els.userEmail.textContent=user.email||'';
  await refreshBaseData(); if(!state.month)state.month=await determineLatestMonth(); els.monthPicker.value=state.month; const firstView=FEATURE_CATALOG.find(x=>prefEnabled('feature_flags',x.id))?.id||'settings'; await switchView(firstView);
}
async function determineLatestMonth(){const {data}=await supabase.from('transactions').select('transaction_date').order('transaction_date',{ascending:false}).limit(1);return data?.[0]?.transaction_date?.slice(0,7)||currentMonth();}
async function refreshBaseData(){
  const queries=[supabase.from('categories').select('*').order('main_category').order('subcategory'),supabase.from('transactions').select('*',{count:'exact',head:true}).eq('classification_status','needs_review')];
  const [{data:cats},{count}]=await Promise.all(queries);state.categories=cats||[];els.reviewBadge.textContent=count||0;els.reviewBadge.classList.toggle('hidden',!count);
  try{const {data:settings,error}=await supabase.from('category_settings').select('*');if(!error){state.categorySettings=settings||[];state.categorySettingsMap=new Map(state.categorySettings.map(s=>[settingsKey(s.main_category,s.subcategory||''),{treatment:s.pnl_treatment,profile:s.spend_profile,display_name:s.display_name,sort_order:s.sort_order}]));}}catch{}
  await loadPreferences();applyFeatureVisibility();
}
async function loadPreferences(){
  const defaults=defaultPreferences();
  try{const {data,error}=await supabase.from('user_preferences').select('*').maybeSingle();if(error)throw error;state.preferences={feature_flags:{...defaults.feature_flags,...(data?.feature_flags||{})},dashboard_widgets:{...defaults.dashboard_widgets,...(data?.dashboard_widgets||{})},explore_widgets:{...defaults.explore_widgets,...(data?.explore_widgets||{})}};}catch(e){console.warn('Preferences unavailable; using defaults.',e?.message||e);state.preferences=defaults;}
}
function applyFeatureVisibility(){document.querySelectorAll('[data-feature]').forEach(el=>el.classList.toggle('hidden',!prefEnabled('feature_flags',el.dataset.feature)));}
async function loadMonthData(){
  const from=monthStart(state.month),to=nextMonthStart(state.month);
  const [{data:tx,error:e1},{data:budgets,error:e2}]=await Promise.all([
    supabase.from('transactions').select('*').gte('transaction_date',from).lt('transaction_date',to).order('transaction_date',{ascending:false}).limit(5000),
    supabase.from('budgets').select('*').eq('month',from)
  ]);if(e1)throw e1;if(e2)throw e2;state.transactions=tx||[];state.budgets=budgets||[];
}
async function loadReview(){const {data,error}=await supabase.from('transactions').select('*').eq('classification_status','needs_review').order('transaction_date',{ascending:false}).limit(2000);if(error)throw error;state.review=data||[];}
async function fetchAllTransactions(){
  if(state.allTransactions)return state.allTransactions;const all=[];let from=0;const page=1000;
  while(true){const {data,error}=await supabase.from('transactions').select('*').order('transaction_date',{ascending:true}).range(from,from+page-1);if(error)throw error;all.push(...(data||[]));if(!data||data.length<page)break;from+=page;}
  state.allTransactions=all;return all;
}
async function loadBalanceData(){
  try{
    const [{data:items,error:e1},{data:vals,error:e2}]=await Promise.all([supabase.from('balance_items').select('*').order('side').order('group_name').order('sort_order').order('name'),supabase.from('balance_values').select('*').order('as_of_date',{ascending:true}).limit(10000)]);
    if(e1)throw e1;if(e2)throw e2;state.balanceItems=items||[];state.balanceValues=vals||[];
  }catch(e){if(String(e.message||'').toLowerCase().includes('balance_items'))throw new Error('Run upgrade.sql in Supabase first, then refresh this page.');throw e;}
}
function invalidateTransactions(){state.allTransactions=null;}
function setViewMeta(title,subtitle='',showMonth=true,eyebrow='Household CFO'){els.viewTitle.textContent=title;els.viewSubtitle.textContent=subtitle;els.viewEyebrow.textContent=eyebrow;els.monthPickerWrap.classList.toggle('hidden',!showMonth);}
async function switchView(view){
  state.currentView=view;destroyCharts();document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));const el=$(`${view}View`);if(el)el.classList.remove('hidden');
  try{
    if(view==='dashboard'){setViewMeta('Overview','What changed, what matters, and where cash is going');await Promise.all([loadMonthData(),fetchAllTransactions(),loadBalanceData().catch(()=>{})]);renderDashboard();}
    if(view==='income'){setViewMeta('Income Statement','A finance-grade view of household earnings, recurring cost and cash surplus');await fetchAllTransactions();renderIncomeStatement();}
    if(view==='balance'){setViewMeta('Balance Sheet','Assets, liabilities, liquidity and net worth',false);await Promise.all([loadBalanceData(),fetchAllTransactions()]);renderBalanceSheet();}
    if(view==='explore'){setViewMeta('Explore','Long- and short-horizon spending intelligence');await fetchAllTransactions();renderExplore();}
    if(view==='transactions'){setViewMeta('Transactions','Search and correct classifications');await loadMonthData();renderTransactions();}
    if(view==='review'){setViewMeta('Needs review','Only transactions the rule engine could not classify',false);await loadReview();renderReview();}
    if(view==='budget'){setViewMeta('Budget','Monthly budget, variance and current run-rate');await Promise.all([loadMonthData(),fetchAllTransactions()]);renderBudget();}
    if(view==='import'){setViewMeta('Import','Bring in history or new bank/card exports',false);renderImport();}
    if(view==='settings'){setViewMeta('Modules','Choose what the workstation shows and keep the interface focused',false,'Workspace configuration');renderSettings();}
  }catch(e){console.error(e);toast(e.message||'Something went wrong');}
}

function monthlySeries(rows,start,end){
  return monthKeys(start,end).map(ym=>{const s=summarize(rowsBetween(rows,monthStart(ym),nextMonthStart(ym)));return {month:ym,...s};});
}
function categorySpend(rows,includeFinancial=true){
  const map=new Map();for(const t of rows){const tr=treatment(t);if(tr!=='operating_expense'&&!(includeFinancial&&tr==='financial_expense'))continue;const v=expenseValue(t);const k=t.main_category||'Unclassified';map.set(k,(map.get(k)||0)+v);}return [...map.entries()].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
}
function categorySubSpend(rows){
  const map=new Map();for(const t of rows){const tr=treatment(t);if(!['operating_expense','financial_expense'].includes(tr))continue;const v=expenseValue(t);if(v===0)continue;const k=`${t.main_category||'Unclassified'}\u0000${t.subcategory||'Other'}`;map.set(k,(map.get(k)||0)+v);}return [...map.entries()].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
}
function buildInsights(all,month){
  const insights=[];const end=nextMonthStart(month),m12=addMonths(end,-12),p12=addMonths(m12,-12),m3=addMonths(end,-3),p3=addMonths(end,-6);
  const s12=summarize(rowsBetween(all,m12,end)),sp12=summarize(rowsBetween(all,p12,m12)),s3=summarize(rowsBetween(all,m3,end)),sp3=summarize(rowsBetween(all,p3,m3));
  const coreGrowth=pctChange(s12.coreOutflow,sp12.coreOutflow);if(Number.isFinite(coreGrowth))insights.push({title:'Core cash cost',text:`TTM core outflow is ${fmtPct(Math.abs(coreGrowth))} ${coreGrowth>=0?'higher':'lower'} than the preceding 12 months (${fmtSEK.format(s12.coreOutflow)}).`,tone:coreGrowth>0.1?'watch':'neutral'});
  if(Number.isFinite(s12.savingsRate))insights.push({title:'Savings conversion',text:`${fmtPct(s12.savingsRate)} of core income converted to core cash surplus over the last 12 months.`,tone:s12.savingsRate>0.25?'good':'neutral'});
  const runRate=s3.coreOutflow/3*12;if(s12.coreOutflow>0)insights.push({title:'Current run-rate',text:`The last 3 months annualise to ${fmtSEK.format(runRate)}, ${fmtPct(Math.abs(runRate/s12.coreOutflow-1))} ${runRate>=s12.coreOutflow?'above':'below'} the TTM level.`,tone:runRate>s12.coreOutflow*1.12?'watch':'neutral'});
  const curCats=new Map(categorySpend(rowsBetween(all,m12,end))),prevCats=new Map(categorySpend(rowsBetween(all,p12,m12)));const drivers=[...new Set([...curCats.keys(),...prevCats.keys()])].map(k=>[k,(curCats.get(k)||0)-(prevCats.get(k)||0),curCats.get(k)||0]).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  if(drivers[0])insights.push({title:'Largest spending driver',text:`${drivers[0][0]} is the largest TTM change: ${drivers[0][1]>=0?'+':''}${fmtSEK.format(drivers[0][1])} versus the preceding 12 months.`,tone:drivers[0][1]>0?'watch':'good'});
  const incGrowth=pctChange(s12.coreIncome,sp12.coreIncome);if(Number.isFinite(incGrowth)&&Number.isFinite(coreGrowth))insights.push({title:'Operating leverage',text:`Core income changed ${incGrowth>=0?'+':''}${fmtPct(incGrowth)} while core cash cost changed ${coreGrowth>=0?'+':''}${fmtPct(coreGrowth)}. ${incGrowth>coreGrowth?'Savings capacity is expanding.':'Cost growth is outrunning income growth.'}`,tone:incGrowth>coreGrowth?'good':'watch'});
  const fiveEnd=end,fiveStart=addMonths(end,-72),fiveBaseEnd=addMonths(end,-60);const fiveNow=summarize(rowsBetween(all,addMonths(end,-12),end)).coreOutflow,fiveBase=summarize(rowsBetween(all,fiveStart,fiveBaseEnd)).coreOutflow;if(fiveBase>0&&fiveNow>0){const cagr=Math.pow(fiveNow/fiveBase,1/5)-1;insights.push({title:'Lifestyle inflation',text:`Core cash cost has compounded at approximately ${fmtPct(cagr)} per year over five years, from ${fmtSEK.format(fiveBase)} to ${fmtSEK.format(fiveNow)} TTM.`,tone:cagr>0.06?'watch':'neutral'});}
  const extra=s12.extraordinary;if(extra>0)insights.push({title:'Extraordinary items',text:`${fmtSEK.format(extra)} of extraordinary spending occurred in the last 12 months and is excluded from core run-rate analysis.`,tone:'neutral'});
  const monthNo=Number(month.slice(5,7));const current=summarize(rowsBetween(all,monthStart(month),end)).coreOutflow;const comps=[];
  for(let y=Number(all[0]?.transaction_date?.slice(0,4)||0);y<Number(month.slice(0,4));y++){const ym=`${y}-${String(monthNo).padStart(2,'0')}`;const rr=rowsBetween(all,monthStart(ym),nextMonthStart(ym));if(rr.length)comps.push(summarize(rr).coreOutflow);}
  if(comps.length>=3){const p=percentileRank(comps,current);insights.push({title:'Same-month context',text:`This month’s core outflow sits at roughly the ${Math.round(p*100)}th percentile versus the same calendar month historically.`,tone:p>0.8?'watch':p<0.3?'good':'neutral'});}
  return insights.slice(0,8);
}

function balanceAsOf(date){
  const latest=new Map();for(const v of state.balanceValues){if(v.as_of_date>date)continue;const old=latest.get(v.item_id);if(!old||old.as_of_date<v.as_of_date)latest.set(v.item_id,v);}
  const rows=state.balanceItems.filter(i=>i.active!==false).map(i=>({...i,value:Number(latest.get(i.id)?.value_sek||0),value_date:latest.get(i.id)?.as_of_date||null}));
  const assets=sum(rows.filter(x=>x.side==='asset'),x=>x.value),liabilities=sum(rows.filter(x=>x.side==='liability'),x=>x.value),liquid=sum(rows.filter(x=>x.side==='asset'&&['Liquid','Near-liquid'].includes(x.liquidity_bucket)),x=>x.value);
  return {rows,assets,liabilities,netWorth:assets-liabilities,liquid};
}
function balanceHistory(){
  const dates=[...new Set(state.balanceValues.map(v=>v.as_of_date))].sort();return dates.map(date=>({date,...balanceAsOf(date)}));
}
function latestBalanceDate(){return state.balanceValues.length?[...state.balanceValues].sort((a,b)=>b.as_of_date.localeCompare(a.as_of_date))[0].as_of_date:null;}
function kpiCard(label,value,sub='',cls=''){return `<div class="card kpi-card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value ${cls}">${value}</div>${sub?`<div class="kpi-sub">${sub}</div>`:''}</div>`;}
function insightHtml(insights){return `<div class="insight-list">${insights.map(i=>`<div class="insight ${i.tone||''}"><span class="insight-dot"></span><div><strong>${esc(i.title)}</strong><span>${esc(i.text)}</span></div></div>`).join('')}</div>`;}

function renderDashboard(){
  destroyCharts();
  const all=state.allTransactions||[],monthRows=rowsBetween(all,monthStart(state.month),nextMonthStart(state.month)),m=summarize(monthRows);const ttmB=periodBounds('ttm',state.month),ttm=summarize(rowsBetween(all,ttmB.start,ttmB.end));
  const series=monthlySeries(all,addMonths(nextMonthStart(state.month),-12),nextMonthStart(state.month));const insights=buildInsights(all,state.month).slice(0,5);
  const bdate=latestBalanceDate(),bal=bdate?balanceAsOf(bdate):null;const budgetTotal=state.budgets.reduce((a,b)=>a+Number(b.amount),0);const budgetVar=budgetTotal?m.operating-budgetTotal:NaN;
  const cats=categorySpend(monthRows,false);const allSubs=categorySubSpend(monthRows);
  els.dashboardView.innerHTML=`
    ${prefEnabled('dashboard_widgets','kpis')?`<div class="kpi-grid six">
      ${kpiCard('Core income',fmtSEK.format(m.coreIncome),'Excludes reimbursements and transfers','positive')}
      ${kpiCard('Core cash cost',fmtSEK.format(m.coreOutflow),`${fmtSEK.format(m.operating)} household + ${fmtSEK.format(m.financial)} financial`)}
      ${kpiCard('Core surplus',fmtSEK.format(m.coreSurplus),`${fmtPct(m.savingsRate)} savings conversion`,m.coreSurplus>=0?'positive':'negative')}
      ${kpiCard('TTM core spend',fmtSEK.format(ttm.coreOutflow),`${fmtSEK.format(ttm.coreOutflow/12)} average / month`)}
      ${kpiCard('Extraordinary',fmtSEK.format(m.extraordinary),'Shown outside core run-rate')}
      ${kpiCard('Net worth',bal?fmtSEK.format(bal.netWorth):'—',bdate?`As of ${bdate}`:'Add a balance-sheet snapshot',bal&&bal.netWorth>=0?'positive':'')}
    </div>`:''}
    <div class="hero-grid">
      ${prefEnabled('dashboard_widgets','cash_trend')?`<div class="card chart-card"><div class="card-head"><div><div class="section-kicker">Cash conversion</div><h2>Income, cost and surplus</h2></div><span class="pill">12 months</span></div><div class="chart-wrap tall"><canvas id="cashTrendChart"></canvas></div></div>`:''}
      ${prefEnabled('dashboard_widgets','waterfall')?`<div class="card chart-card"><div class="card-head"><div><div class="section-kicker">Current month</div><h2>Cash bridge</h2></div></div><div id="cashWaterfall" class="plot-wrap tall"></div></div>`:''}
    </div>
    <div class="content-grid equal">
      ${prefEnabled('dashboard_widgets','spend_map')?`<div class="card"><div class="card-head"><div><div class="section-kicker">Consumption mix</div><h2>Household spending map</h2></div><span class="pill">${esc(monthLabel(state.month))}</span></div><div id="spendTreemap" class="plot-wrap"></div></div>`:''}
      ${prefEnabled('dashboard_widgets','insights')?`<div class="card"><div class="card-head"><div><div class="section-kicker">Decision signals</div><h2>What deserves attention</h2></div></div>${insightHtml(insights)}</div>`:''}
    </div>
    <div class="content-grid equal">
      ${prefEnabled('dashboard_widgets','categories')?`<div class="card"><h2>Largest categories</h2><div class="category-list">${cats.slice(0,10).map(([c,v])=>{const max=cats[0]?.[1]||1;return `<div class="category-item"><div><strong>${esc(c.replaceAll('_',' '))}</strong><div class="bar"><div style="width:${Math.max(2,v/max*100)}%"></div></div></div><div>${fmtSEK.format(v)}</div><div class="muted">${m.operating?Math.round(v/m.operating*100):0}%</div></div>`;}).join('')||'<div class="empty">No operating expenses.</div>'}</div></div>`:''}
      ${prefEnabled('dashboard_widgets','budget_pulse')?`<div class="card"><h2>Budget pulse</h2>${budgetTotal?`<div class="mini-metric"><span>Operating spend</span><strong>${fmtSEK.format(m.operating)}</strong></div><div class="mini-metric"><span>Budget</span><strong>${fmtSEK.format(budgetTotal)}</strong></div><div class="mini-metric"><span>Variance</span><strong class="${budgetVar>0?'negative':'positive'}">${budgetVar>=0?'+':''}${fmtSEK.format(budgetVar)}</strong></div><div class="progress large"><div style="width:${clamp(m.operating/budgetTotal*100,0,100)}%"></div></div>`:'<div class="empty compact">Set monthly category budgets to add variance tracking here.</div>'}</div>`:''}
    </div>`;

  chart('cashTrendChart',{type:'line',data:{labels:series.map(x=>monthLabel(x.month)),datasets:[
    {label:'Core income',data:series.map(x=>x.coreIncome),borderColor:PALETTE[0],backgroundColor:'rgba(37,99,235,.08)',borderWidth:2.2,tension:.25,pointRadius:2},
    {label:'Core cash cost',data:series.map(x=>x.coreOutflow),borderColor:PALETTE[3],backgroundColor:'rgba(217,119,6,.08)',borderWidth:2.2,tension:.25,pointRadius:2},
    {label:'Core surplus',data:series.map(x=>x.coreSurplus),borderColor:PALETTE[1],backgroundColor:'rgba(15,118,110,.08)',borderWidth:2.2,tension:.25,pointRadius:2}
  ]},options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>`${Math.round(v/1000)}k`},grid:{color:'#eef2f7'}},x:{grid:{display:false}}}}});
  plot('cashWaterfall',[{type:'waterfall',orientation:'v',measure:['absolute','relative','relative','relative','relative','total'],x:['Core income','Household','Financial','Reimb. net','Extraordinary','Net cash surplus'],y:[m.coreIncome,-m.operating,-m.financial,m.reimbNet,-m.extraordinary,0],connector:{line:{color:'#cbd5e1'}},increasing:{marker:{color:'#0f766e'}},decreasing:{marker:{color:'#dc2626'}},totals:{marker:{color:'#0f172a'}},textposition:'outside',text:[fmtNum.format(m.coreIncome),fmtNum.format(-m.operating),fmtNum.format(-m.financial),fmtNum.format(m.reimbNet),fmtNum.format(-m.extraordinary),fmtNum.format(m.netCashSurplus)]}],{margin:{l:30,r:15,t:10,b:55},yaxis:{tickformat:',.0f',gridcolor:'#eef2f7'}});
  if(allSubs.length){const labels=['Spending',...cats.map(x=>x[0].replaceAll('_',' ')),...allSubs.map(([k])=>k.split('\u0000')[1])],ids=['root',...cats.map(x=>`m|${x[0]}`),...allSubs.map(([k])=>`s|${k}`)],parents=['',...cats.map(()=> 'root'),...allSubs.map(([k])=>`m|${k.split('\u0000')[0]}`)],values=[sum(cats,x=>x[1]),...cats.map(x=>x[1]),...allSubs.map(x=>x[1])];plot('spendTreemap',[{type:'treemap',ids,labels,parents,values,branchvalues:'total',textinfo:'label+value+percent parent'}],{margin:{l:0,r:0,t:0,b:0}});}
}

function statementRows(curRows,prevRows){
  const groups=[
    {title:'Core income',treat:['income'],sign:'income'},
    {title:'Household operating expenses',treat:['operating_expense'],sign:'expense'},
    {title:'Financial expenses & fees',treat:['financial_expense'],sign:'expense'},
    {title:'Reimbursable items',treat:['reimbursement_income','reimbursable_expense'],sign:'mixed'},
    {title:'Extraordinary items',treat:['extraordinary'],sign:'expense'}
  ];
  const rows=[];
  for(const g of groups){rows.push({section:true,label:g.title});const mains=[...new Set([...curRows,...prevRows].filter(t=>g.treat.includes(treatment(t))).map(t=>t.main_category||'Unclassified'))].sort();
    for(const main of mains){const c=curRows.filter(t=>t.main_category===main&&g.treat.includes(treatment(t))),p=prevRows.filter(t=>t.main_category===main&&g.treat.includes(treatment(t)));const cv=sum(c,txMetric),pv=sum(p,txMetric);rows.push({label:main.replaceAll('_',' '),current:cv,prior:pv,kind:g.sign,bold:true});
      const subs=[...new Set([...c,...p].map(t=>t.subcategory||'Other'))].sort();for(const sub of subs){const sc=c.filter(t=>(t.subcategory||'Other')===sub),sp=p.filter(t=>(t.subcategory||'Other')===sub);rows.push({label:sub,current:sum(sc,txMetric),prior:sum(sp,txMetric),kind:g.sign,sub:true});}
    }
  }
  return rows;
}
function deltaClass(kind,delta){if(!Number.isFinite(delta)||delta===0)return'';if(kind==='expense')return delta>0?'negative':'positive';if(kind==='income')return delta>0?'positive':'negative';return'';}
function renderIncomeStatement(){
  destroyCharts();
  const all=state.allTransactions||[],b=periodBounds(state.pnlPeriod,state.month),cur=rowsBetween(all,b.start,b.end),prev=rowsBetween(all,b.prevStart,b.prevEnd),cs=summarize(cur),ps=summarize(prev),rows=statementRows(cur,prev);const series=monthlySeries(all,b.start,b.end),cats=categorySpend(cur,true);
  const tr3=monthsBack(state.month,3),s3=summarize(rowsBetween(all,tr3.start,tr3.end));
  els.incomeView.innerHTML=`
    <div class="toolbar statement-toolbar"><div class="segmented" id="pnlPeriodButtons">${[['month','Month'],['ytd','YTD'],['ttm','TTM'],['year','Full year']].map(([k,l])=>`<button data-pnl-period="${k}" class="${state.pnlPeriod===k?'active':''}">${l}</button>`).join('')}</div><span class="toolbar-note">${esc(b.label)} vs comparable prior period</span></div>
    <div class="kpi-grid six">
      ${kpiCard('Core income',fmtSEK.format(cs.coreIncome),`${fmtPct(pctChange(cs.coreIncome,ps.coreIncome))} vs prior`,pctChange(cs.coreIncome,ps.coreIncome)>=0?'positive':'negative')}
      ${kpiCard('Household spend',fmtSEK.format(cs.operating),`${fmtPct(pctChange(cs.operating,ps.operating))} vs prior`,pctChange(cs.operating,ps.operating)>0?'negative':'positive')}
      ${kpiCard('Financial cost',fmtSEK.format(cs.financial),`${fmtPct(pctChange(cs.financial,ps.financial))} vs prior`)}
      ${kpiCard('Core surplus',fmtSEK.format(cs.coreSurplus),`${fmtPct(cs.savingsRate)} savings rate`,cs.coreSurplus>=0?'positive':'negative')}
      ${kpiCard('Extraordinary',fmtSEK.format(cs.extraordinary),'Below core run-rate')}
      ${kpiCard('3m annualised cost',fmtSEK.format(s3.coreOutflow/3*12),`vs TTM ${fmtSEK.format(summarize(rowsBetween(all,periodBounds('ttm',state.month).start,periodBounds('ttm',state.month).end)).coreOutflow)}`)}
    </div>
    <div class="content-grid statement-grid">
      <div class="card"><div class="card-head"><div><div class="section-kicker">Household P&amp;L</div><h2>${esc(b.label)}</h2></div></div>
        <div class="table-wrap"><table class="pnl-table"><thead><tr><th>SEK</th><th class="amount">Current</th><th class="amount">Prior</th><th class="amount">Δ</th><th class="amount">Δ %</th><th class="amount">% income</th></tr></thead><tbody>
          ${rows.map(r=>{if(r.section)return `<tr class="pnl-section"><td colspan="6">${esc(r.label)}</td></tr>`;const d=r.current-r.prior;return `<tr class="${r.sub?'pnl-sub':''} ${r.bold?'pnl-main':''}"><td>${esc(r.label)}</td><td class="amount">${fmtSEK.format(r.current)}</td><td class="amount">${fmtSEK.format(r.prior)}</td><td class="amount ${deltaClass(r.kind,d)}">${d>=0?'+':''}${fmtSEK.format(d)}</td><td class="amount ${deltaClass(r.kind,d)}">${Number.isFinite(pctChange(r.current,r.prior))?fmtPct(pctChange(r.current,r.prior)):'—'}</td><td class="amount muted">${cs.coreIncome?fmtPct(r.current/cs.coreIncome):'—'}</td></tr>`;}).join('')}
          <tr class="pnl-total"><td>Core cash surplus</td><td class="amount">${fmtSEK.format(cs.coreSurplus)}</td><td class="amount">${fmtSEK.format(ps.coreSurplus)}</td><td class="amount ${deltaClass('income',cs.coreSurplus-ps.coreSurplus)}">${fmtSEK.format(cs.coreSurplus-ps.coreSurplus)}</td><td class="amount">${fmtPct(pctChange(cs.coreSurplus,ps.coreSurplus))}</td><td class="amount">${fmtPct(cs.savingsRate)}</td></tr>
          <tr class="pnl-total dark"><td>Net cash surplus after extraordinary &amp; reimbursables</td><td class="amount">${fmtSEK.format(cs.netCashSurplus)}</td><td class="amount">${fmtSEK.format(ps.netCashSurplus)}</td><td class="amount">${fmtSEK.format(cs.netCashSurplus-ps.netCashSurplus)}</td><td class="amount">${fmtPct(pctChange(cs.netCashSurplus,ps.netCashSurplus))}</td><td class="amount">${cs.coreIncome?fmtPct(cs.netCashSurplus/cs.coreIncome):'—'}</td></tr>
        </tbody></table></div>
      </div>
      <div class="side-stack">
        <div class="card"><div class="section-kicker">Expense mix</div><h2>Where the money goes</h2><div class="chart-wrap"><canvas id="pnlMixChart"></canvas></div></div>
        <div class="card"><div class="section-kicker">Period bridge</div><h2>From income to cash surplus</h2><div id="pnlWaterfall" class="plot-wrap"></div></div>
      </div>
    </div>
    <div class="card"><div class="card-head"><div><div class="section-kicker">Monthly cadence</div><h2>Income vs recurring cash cost</h2></div></div><div class="chart-wrap"><canvas id="pnlMonthlyChart"></canvas></div></div>`;
  document.querySelectorAll('[data-pnl-period]').forEach(btn=>btn.addEventListener('click',()=>{state.pnlPeriod=btn.dataset.pnlPeriod;renderIncomeStatement();}));
  chart('pnlMixChart',{type:'doughnut',data:{labels:cats.slice(0,10).map(x=>x[0].replaceAll('_',' ')),datasets:[{data:cats.slice(0,10).map(x=>x[1]),backgroundColor:PALETTE}]},options:{maintainAspectRatio:false,cutout:'64%',plugins:{legend:{position:'bottom',labels:{boxWidth:10}}}}});
  chart('pnlMonthlyChart',{type:'bar',data:{labels:series.map(x=>monthLabel(x.month)),datasets:[{label:'Core income',data:series.map(x=>x.coreIncome),backgroundColor:'rgba(37,99,235,.78)'},{label:'Core cash cost',data:series.map(x=>x.coreOutflow),backgroundColor:'rgba(217,119,6,.75)'},{label:'Core surplus',data:series.map(x=>x.coreSurplus),type:'line',borderColor:'#0f766e',backgroundColor:'#0f766e',borderWidth:2.2,tension:.2,pointRadius:2}]},options:{maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{x:{stacked:false,grid:{display:false}},y:{ticks:{callback:v=>`${Math.round(v/1000)}k`},grid:{color:'#eef2f7'}}}}});
  plot('pnlWaterfall',[{type:'waterfall',measure:['absolute','relative','relative','relative','relative','total'],x:['Core income','Operating','Financial','Reimb. net','Extraordinary','Net cash surplus'],y:[cs.coreIncome,-cs.operating,-cs.financial,cs.reimbNet,-cs.extraordinary,0],increasing:{marker:{color:'#0f766e'}},decreasing:{marker:{color:'#dc2626'}},totals:{marker:{color:'#0f172a'}},connector:{line:{color:'#cbd5e1'}}}],{margin:{l:35,r:10,t:8,b:55},yaxis:{gridcolor:'#eef2f7'}});
}

function balanceGroups(rows,side){const map=new Map();for(const r of rows.filter(x=>x.side===side)){map.set(r.group_name,(map.get(r.group_name)||0)+Number(r.value||0));}return [...map.entries()].sort((a,b)=>b[1]-a[1]);}
function renderBalanceSheet(){
  destroyCharts();
  const date=state.balanceDate||new Date().toISOString().slice(0,10),asof=balanceAsOf(date),hist=balanceHistory();const ttm=periodBounds('ttm',state.month),ttmSum=summarize(rowsBetween(state.allTransactions||[],ttm.start,ttm.end));
  const liquidRunway=ttmSum.coreOutflow>0?asof.liquid/(ttmSum.coreOutflow/12):NaN,debtAssets=asof.assets?asof.liabilities/asof.assets:NaN;const assetGroups=balanceGroups(asof.rows,'asset'),liabGroups=balanceGroups(asof.rows,'liability');
  const property=assetGroups.filter(([g])=>/home|property|real estate|house|apartment/i.test(g)).reduce((a,x)=>a+x[1],0),mortgage=liabGroups.filter(([g])=>/mortgage|home loan|property/i.test(g)).reduce((a,x)=>a+x[1],0),ltv=property?mortgage/property:NaN;
  const groupOptions=['Cash','Public Markets','Private Markets','Pension','Property','Other Assets','Mortgage','Consumer Debt','Student Loan','Tax / Other Liabilities'];
  els.balanceView.innerHTML=`
    <div class="toolbar balance-toolbar"><label>Snapshot date<input id="balanceDateInput" type="date" value="${esc(date)}"></label><button id="saveBalanceSnapshot" class="primary">Save snapshot</button><span class="toolbar-note">Enter positive values for both assets and liabilities.</span></div>
    <div class="kpi-grid six">
      ${kpiCard('Total assets',fmtSEK.format(asof.assets),'Gross household asset base')}
      ${kpiCard('Liabilities',fmtSEK.format(asof.liabilities),`${Number.isFinite(debtAssets)?fmtPct(debtAssets):'—'} of assets`)}
      ${kpiCard('Net worth',fmtSEK.format(asof.netWorth),hist.length>1?`${fmtSEK.format(asof.netWorth-hist[Math.max(0,hist.length-2)].netWorth)} vs prior snapshot`:'Add snapshots to build history',asof.netWorth>=0?'positive':'negative')}
      ${kpiCard('Liquid assets',fmtSEK.format(asof.liquid),'Cash + near-liquid assets')}
      ${kpiCard('Liquidity runway',Number.isFinite(liquidRunway)?`${liquidRunway.toFixed(1)} months`:'—','Liquid assets / TTM core cash cost')}
      ${kpiCard('Property LTV',Number.isFinite(ltv)?fmtPct(ltv):'—',Number.isFinite(ltv)?`${fmtSEK.format(mortgage)} mortgage / ${fmtSEK.format(property)} property`:'Uses groups named Property/Home and Mortgage')}
    </div>
    <div class="hero-grid">
      <div class="card"><div class="card-head"><div><div class="section-kicker">Wealth creation</div><h2>Net worth evolution</h2></div></div><div class="chart-wrap tall"><canvas id="netWorthChart"></canvas></div></div>
      <div class="card"><div class="card-head"><div><div class="section-kicker">Asset allocation</div><h2>Current balance-sheet mix</h2></div></div><div class="chart-wrap tall"><canvas id="assetAllocationChart"></canvas></div></div>
    </div>
    <div class="content-grid equal">
      <div class="card"><div class="card-head"><div><div class="section-kicker">Assets</div><h2>Asset schedule</h2></div></div>${balanceScheduleHtml(asof.rows.filter(x=>x.side==='asset'))}</div>
      <div class="card"><div class="card-head"><div><div class="section-kicker">Liabilities</div><h2>Liability schedule</h2></div></div>${balanceScheduleHtml(asof.rows.filter(x=>x.side==='liability'))}</div>
    </div>
    <div class="card"><div class="card-head"><div><div class="section-kicker">Structure</div><h2>Add a balance-sheet item</h2></div></div>
      <div class="balance-add"><label>Name<input id="bsName" placeholder="e.g. Main residence"></label><label>Side<select id="bsSide"><option value="asset">Asset</option><option value="liability">Liability</option></select></label><label>Group<input id="bsGroup" list="bsGroups" placeholder="Property"></label><datalist id="bsGroups">${groupOptions.map(g=>`<option value="${g}">`).join('')}</datalist><label>Liquidity<select id="bsLiquidity"><option>Liquid</option><option>Near-liquid</option><option selected>Illiquid</option><option>N/A</option></select></label><button id="addBalanceItem" class="secondary">Add item</button></div>
    </div>`;
  $('balanceDateInput').addEventListener('change',e=>{state.balanceDate=e.target.value;renderBalanceSheet();});$('saveBalanceSnapshot').addEventListener('click',saveBalanceSnapshot);$('addBalanceItem').addEventListener('click',addBalanceItem);document.querySelectorAll('[data-delete-bs]').forEach(b=>b.addEventListener('click',()=>deleteBalanceItem(b.dataset.deleteBs)));
  if(hist.length){chart('netWorthChart',{type:'line',data:{labels:hist.map(x=>x.date),datasets:[{label:'Assets',data:hist.map(x=>x.assets),borderColor:PALETTE[0],backgroundColor:'rgba(37,99,235,.08)',fill:true,tension:.2,pointRadius:2},{label:'Liabilities',data:hist.map(x=>x.liabilities),borderColor:PALETTE[5],backgroundColor:'rgba(8,145,178,.06)',tension:.2,pointRadius:2},{label:'Net worth',data:hist.map(x=>x.netWorth),borderColor:PALETTE[1],backgroundColor:'rgba(15,118,110,.08)',borderWidth:3,tension:.2,pointRadius:2}]},options:{maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{x:{grid:{display:false}},y:{ticks:{callback:v=>`${(v/1e6).toFixed(1)}m`},grid:{color:'#eef2f7'}}}}});}
  if(assetGroups.length)chart('assetAllocationChart',{type:'doughnut',data:{labels:assetGroups.map(x=>x[0]),datasets:[{data:assetGroups.map(x=>x[1]),backgroundColor:PALETTE}]},options:{maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom'}}}});
}
function balanceScheduleHtml(rows){
  if(!rows.length)return '<div class="empty compact">No items yet.</div>';const groups=[...new Set(rows.map(x=>x.group_name))];return `<div class="balance-schedule">${groups.map(g=>{const rr=rows.filter(x=>x.group_name===g);return `<div class="balance-group"><div class="balance-group-title"><span>${esc(g)}</span><strong>${fmtSEK.format(sum(rr,x=>x.value))}</strong></div>${rr.map(x=>`<div class="balance-row"><div><strong>${esc(x.name)}</strong><span class="muted small">${esc(x.liquidity_bucket)}</span></div><input type="number" step="1000" data-bs-value="${x.id}" value="${Number(x.value||0)}"><span class="muted small">${x.value_date?`Last: ${esc(x.value_date)}`:'No snapshot'}</span><button class="icon-button" data-delete-bs="${x.id}" title="Delete">×</button></div>`).join('')}</div>`;}).join('')}</div>`;
}
async function addBalanceItem(){const name=$('bsName').value.trim(),side=$('bsSide').value,group=$('bsGroup').value.trim(),liquidity=$('bsLiquidity').value;if(!name||!group)return toast('Add a name and group');const {error}=await supabase.from('balance_items').insert({owner_id:state.user.id,name,side,group_name:group,liquidity_bucket:side==='liability'?'N/A':liquidity});if(error)return toast(error.message);await loadBalanceData();toast('Balance-sheet item added');renderBalanceSheet();}
async function deleteBalanceItem(id){if(!confirm('Delete this balance-sheet item and its snapshots?'))return;const {error}=await supabase.from('balance_items').delete().eq('id',id);if(error)return toast(error.message);await loadBalanceData();renderBalanceSheet();}
async function saveBalanceSnapshot(){const date=$('balanceDateInput').value;if(!date)return toast('Choose a date');const rows=[...document.querySelectorAll('[data-bs-value]')].map(i=>({owner_id:state.user.id,item_id:i.dataset.bsValue,as_of_date:date,value_sek:asNumber(i.value),updated_at:new Date().toISOString()}));if(!rows.length)return toast('Add balance-sheet items first');const {error}=await supabase.from('balance_values').upsert(rows,{onConflict:'owner_id,item_id,as_of_date'});if(error)return toast(error.message);state.balanceDate=date;await loadBalanceData();toast('Balance-sheet snapshot saved');renderBalanceSheet();}

function rollingAverage(values,n){return values.map((_,i)=>{const s=values.slice(Math.max(0,i-n+1),i+1);return s.reduce((a,b)=>a+b,0)/s.length;});}
function exploreBounds(){const all=state.allTransactions||[],end=nextMonthStart(state.month);if(state.exploreHorizon==='all')return {start:all[0]?.transaction_date||addMonths(end,-12),end};return {start:addMonths(end,-Number(state.exploreHorizon)),end};}
function renderExplore(){
  destroyCharts();
  const all=state.allTransactions||[],b=exploreBounds(),rows=rowsBetween(all,b.start,b.end),series=monthlySeries(all,b.start,b.end),spend=series.map(x=>x.coreOutflow),roll3=rollingAverage(spend,3),roll12=rollingAverage(spend,12);const cats=categorySpend(rows,true),subs=categorySubSpend(rows),insights=buildInsights(all,state.month);
  const topCats=cats.slice(0,7).map(x=>x[0]),stackData=topCats.map(cat=>({label:cat.replaceAll('_',' '),data:series.map(s=>categorySpend(rowsBetween(all,monthStart(s.month),nextMonthStart(s.month)),true).find(x=>x[0]===cat)?.[1]||0)}));
  const years=[...new Set(rows.map(t=>t.transaction_date.slice(0,4)))].sort(),months=[1,2,3,4,5,6,7,8,9,10,11,12],heat=years.map(y=>months.map(m=>{const ym=`${y}-${String(m).padStart(2,'0')}`;return summarize(rowsBetween(all,monthStart(ym),nextMonthStart(ym))).coreOutflow;}));
  const merchants=new Map();for(const t of rows){if(!['operating_expense','financial_expense'].includes(treatment(t)))continue;const k=merchantKey(t.description);merchants.set(k,(merchants.get(k)||0)+expenseValue(t));}const merchantTop=[...merchants.entries()].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,15),totalSpend=sum(cats,x=>x[1]);
  const dow=[0,0,0,0,0,0,0];for(const t of rows){if(!['operating_expense','financial_expense'].includes(treatment(t)))continue;const d=new Date(`${t.transaction_date}T12:00:00Z`).getUTCDay();dow[d]+=expenseValue(t);}const dowOrdered=[1,2,3,4,5,6,0].map(i=>dow[i]);
  const ySumm=years.map(y=>{const s=summarize(rowsBetween(all,`${y}-01-01`,`${Number(y)+1}-01-01`));return {y,...s};});
  const last3=monthsBack(state.month,3),prior12={start:addMonths(last3.start,-12),end:last3.start};const c3=new Map(categorySpend(rowsBetween(all,last3.start,last3.end))),p12=new Map(categorySpend(rowsBetween(all,prior12.start,prior12.end)));const momentum=[...new Set([...c3.keys(),...p12.keys()])].map(k=>{const cur=(c3.get(k)||0)/3,base=(p12.get(k)||0)/12;return [k,cur,base,pctChange(cur,base),cur-base];}).filter(x=>x[1]>500||x[2]>500).sort((a,b)=>Math.abs(b[4])-Math.abs(a[4])).slice(0,12);
  els.exploreView.innerHTML=`
    <div class="toolbar"><div class="segmented">${[['3','3m'],['12','1y'],['36','3y'],['60','5y'],['all','All']].map(([k,l])=>`<button data-horizon="${k}" class="${state.exploreHorizon===k?'active':''}">${l}</button>`).join('')}</div><span class="toolbar-note">${esc(b.start)} → ${esc(addMonths(b.end,-1))}</span></div>
    ${prefEnabled('explore_widgets','kpis')?`<div class="kpi-grid five">
      ${kpiCard('Period core spend',fmtSEK.format(sum(series,x=>x.coreOutflow)),`${series.length} months analysed`)}
      ${kpiCard('Average / month',fmtSEK.format(series.length?sum(series,x=>x.coreOutflow)/series.length:0),'Core household + financial')}
      ${kpiCard('Top 5 merchants',fmtPct(totalSpend?sum(merchantTop.slice(0,5),x=>x[1])/totalSpend:NaN),'Share of analysed core spend')}
      ${kpiCard('Largest category',cats[0]?cats[0][0].replaceAll('_',' '):'—',cats[0]?`${fmtSEK.format(cats[0][1])} / ${fmtPct(cats[0][1]/totalSpend)}`:'')}
      ${kpiCard('Extraordinary',fmtSEK.format(summarize(rows).extraordinary),'Excluded from core trends')}
    </div>`:''}
    ${prefEnabled('explore_widgets','trajectory')?`<div class="card"><div class="card-head"><div><div class="section-kicker">Run-rate</div><h2>Core spending trajectory</h2></div></div><div class="chart-wrap tall"><canvas id="spendTrajectoryChart"></canvas></div></div>`:''}
    <div class="hero-grid">
      ${prefEnabled('explore_widgets','category_evolution')?`<div class="card"><div class="card-head"><div><div class="section-kicker">Composition</div><h2>Category evolution</h2></div></div><div class="chart-wrap tall"><canvas id="categoryStackChart"></canvas></div></div>`:''}
      ${prefEnabled('explore_widgets','seasonality')?`<div class="card"><div class="card-head"><div><div class="section-kicker">Seasonality</div><h2>Monthly spending heatmap</h2></div></div><div id="seasonalityHeatmap" class="plot-wrap tall"></div></div>`:''}
    </div>
    <div class="content-grid equal">
      ${prefEnabled('explore_widgets','treemap')?`<div class="card"><div class="section-kicker">Drill-down</div><h2>Category / subcategory map</h2><div id="exploreTreemap" class="plot-wrap"></div></div>`:''}
      ${prefEnabled('explore_widgets','merchants')?`<div class="card"><div class="section-kicker">Concentration</div><h2>Largest merchant patterns</h2><div class="chart-wrap"><canvas id="merchantChart"></canvas></div></div>`:''}
    </div>
    <div class="triple-grid">
      ${prefEnabled('explore_widgets','momentum')?`<div class="card"><div class="section-kicker">Momentum</div><h2>What is accelerating?</h2><div class="change-list">${momentum.map(([k,cur,base,ch])=>`<div class="change-row"><strong>${esc(k.replaceAll('_',' '))}</strong><span>${fmtSEK.format(cur)}/m</span><span class="muted">vs ${fmtSEK.format(base)}</span><span class="${ch>0?'negative':'positive'}">${Number.isFinite(ch)?`${ch>=0?'+':''}${fmtPct(ch)}`:'—'}</span></div>`).join('')||'<div class="empty compact">Not enough history.</div>'}</div></div>`:''}
      ${prefEnabled('explore_widgets','weekday')?`<div class="card"><div class="section-kicker">Behaviour</div><h2>Spend by weekday</h2><div class="chart-wrap short"><canvas id="dowChart"></canvas></div></div>`:''}
      ${prefEnabled('explore_widgets','signals')?`<div class="card"><div class="section-kicker">Signals</div><h2>Interpretation</h2>${insightHtml(insights)}</div>`:''}
    </div>
    ${prefEnabled('explore_widgets','annual_pnl')?`<div class="card"><div class="card-head"><div><div class="section-kicker">Long-term record</div><h2>Year-by-year household P&amp;L</h2></div></div><div class="table-wrap"><table><thead><tr><th>Year</th><th class="amount">Core income</th><th class="amount">Household spend</th><th class="amount">Financial cost</th><th class="amount">Extraordinary</th><th class="amount">Core surplus</th><th class="amount">Savings rate</th><th class="amount">Spend growth</th></tr></thead><tbody>${ySumm.map((s,i)=>`<tr><td><strong>${s.y}</strong></td><td class="amount">${fmtSEK.format(s.coreIncome)}</td><td class="amount">${fmtSEK.format(s.operating)}</td><td class="amount">${fmtSEK.format(s.financial)}</td><td class="amount">${fmtSEK.format(s.extraordinary)}</td><td class="amount ${s.coreSurplus>=0?'positive':'negative'}">${fmtSEK.format(s.coreSurplus)}</td><td class="amount">${fmtPct(s.savingsRate)}</td><td class="amount ${i&&pctChange(s.coreOutflow,ySumm[i-1].coreOutflow)>0?'negative':'positive'}">${i?fmtPct(pctChange(s.coreOutflow,ySumm[i-1].coreOutflow)):'—'}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
  document.querySelectorAll('[data-horizon]').forEach(b=>b.addEventListener('click',()=>{state.exploreHorizon=b.dataset.horizon;renderExplore();}));
  chart('spendTrajectoryChart',{type:'line',data:{labels:series.map(x=>monthLabel(x.month)),datasets:[{label:'Monthly core spend',data:spend,borderColor:'#94a3b8',backgroundColor:'rgba(148,163,184,.08)',borderWidth:1.4,pointRadius:1,tension:.15},{label:'3m average',data:roll3,borderColor:PALETTE[3],borderWidth:2.2,pointRadius:0,tension:.2},{label:'12m average',data:roll12,borderColor:PALETTE[0],borderWidth:3,pointRadius:0,tension:.2}]},options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'}},scales:{x:{grid:{display:false}},y:{ticks:{callback:v=>`${Math.round(v/1000)}k`},grid:{color:'#eef2f7'}}}}});
  chart('categoryStackChart',{type:'bar',data:{labels:series.map(x=>monthLabel(x.month)),datasets:stackData.map((d,i)=>({...d,backgroundColor:PALETTE[i%PALETTE.length],stack:'spend'}))},options:{maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,ticks:{callback:v=>`${Math.round(v/1000)}k`},grid:{color:'#eef2f7'}}}}});
  plot('seasonalityHeatmap',[{type:'heatmap',x:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],y:years,z:heat,colorscale:'Blues',hovertemplate:'%{y} %{x}<br>%{z:,.0f} SEK<extra></extra>'}],{margin:{l:45,r:15,t:5,b:35}});
  if(subs.length){const labels=['Spending',...cats.map(x=>x[0].replaceAll('_',' ')),...subs.map(([k])=>k.split('\u0000')[1])],ids=['root',...cats.map(x=>`m|${x[0]}`),...subs.map(([k])=>`s|${k}`)],parents=['',...cats.map(()=> 'root'),...subs.map(([k])=>`m|${k.split('\u0000')[0]}`)],values=[totalSpend,...cats.map(x=>x[1]),...subs.map(x=>x[1])];plot('exploreTreemap',[{type:'treemap',ids,labels,parents,values,branchvalues:'total',textinfo:'label+value+percent parent'}],{margin:{l:0,r:0,t:0,b:0}});}
  chart('merchantChart',{type:'bar',data:{labels:merchantTop.slice(0,10).map(x=>x[0].slice(0,24)),datasets:[{label:'Spend',data:merchantTop.slice(0,10).map(x=>x[1]),backgroundColor:PALETTE[0]}]},options:{maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>`${Math.round(v/1000)}k`},grid:{color:'#eef2f7'}},y:{grid:{display:false}}}}});
  chart('dowChart',{type:'bar',data:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],datasets:[{data:dowOrdered,backgroundColor:PALETTE}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{ticks:{callback:v=>`${Math.round(v/1000)}k`},grid:{color:'#eef2f7'}}}}});
}


function moduleToggleRow(item,group){const checked=prefEnabled(group,item.id);return `<label class="module-row"><span><strong>${esc(item.label)}</strong>${item.description?`<small>${esc(item.description)}</small>`:''}</span><input type="checkbox" data-pref-group="${group}" data-pref-id="${item.id}" ${checked?'checked':''}></label>`;}
function renderSettings(){
  els.settingsView.innerHTML=`
    <div class="settings-intro card"><div><div class="section-kicker">Modular workspace</div><h2>Choose what you want to see</h2><p class="muted">These switches only change your workspace. They do not delete transactions, classifications, balance-sheet data or budgets.</p></div><div><button id="resetModules" class="secondary">Reset defaults</button> <button id="saveModules" class="primary">Save configuration</button></div></div>
    <div class="settings-grid">
      <div class="card"><div class="section-kicker">Navigation</div><h2>Capabilities</h2><div class="module-list">${FEATURE_CATALOG.map(x=>moduleToggleRow(x,'feature_flags')).join('')}</div></div>
      <div class="card"><div class="section-kicker">Overview</div><h2>Dashboard widgets</h2><div class="module-list">${DASHBOARD_WIDGETS.map(x=>moduleToggleRow(x,'dashboard_widgets')).join('')}</div></div>
      <div class="card"><div class="section-kicker">Explore</div><h2>Analytical widgets</h2><div class="module-list">${EXPLORE_WIDGETS.map(x=>moduleToggleRow(x,'explore_widgets')).join('')}</div></div>
    </div>
    <div class="info" style="margin-top:15px"><strong>Designed for iteration.</strong> Future capabilities can be added to the feature catalog and will automatically appear here as a switch. This keeps the core navigation stable while the analytical toolkit grows.</div>`;
  $('saveModules')?.addEventListener('click',savePreferencesFromUI);$('resetModules')?.addEventListener('click',async()=>{state.preferences=defaultPreferences();await persistPreferences();renderSettings();applyFeatureVisibility();toast('Defaults restored');});
}
async function persistPreferences(){const payload={owner_id:state.user.id,feature_flags:state.preferences.feature_flags,dashboard_widgets:state.preferences.dashboard_widgets,explore_widgets:state.preferences.explore_widgets,updated_at:new Date().toISOString()};const {error}=await supabase.from('user_preferences').upsert(payload,{onConflict:'owner_id'});if(error)throw error;}
async function savePreferencesFromUI(){
  const prefs=defaultPreferences();document.querySelectorAll('[data-pref-group][data-pref-id]').forEach(i=>{prefs[i.dataset.prefGroup][i.dataset.prefId]=i.checked;});state.preferences=prefs;
  try{await persistPreferences();applyFeatureVisibility();toast('Workspace configuration saved');}catch(e){toast(e.message||'Could not save settings');}
}

function transactionTable(rows,includeActions=true){
  if(!rows.length)return '<div class="empty">No transactions found.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Category</th><th>Subcategory</th><th>Accounting</th><th class="amount">Amount</th>${includeActions?'<th></th>':''}</tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.transaction_date)}</td><td class="description" title="${esc(t.description)}">${esc(t.description)}</td><td>${esc(t.account)}</td><td>${esc((t.main_category||'—').replaceAll('_',' '))}</td><td>${esc(t.subcategory||'—')}</td><td><span class="treatment-tag ${treatment(t)}">${esc(treatment(t).replaceAll('_',' '))}</span></td><td class="amount ${Number(t.amount)<0?'negative':'positive'}">${fmtSEK.format(Number(t.amount))}</td>${includeActions?`<td class="row-actions"><button data-edit="${t.id}">Edit</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function renderTransactions(){
  const mainCats=[...new Set(state.categories.map(c=>c.main_category))];
  els.transactionsView.innerHTML=`<div class="filters"><input id="txSearch" placeholder="Search description…"><select id="txCategory"><option value="">All categories</option>${mainCats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select id="txStatus"><option value="">All statuses</option><option value="needs_review">Needs review</option><option value="auto">Auto</option><option value="manual">Manual</option><option value="historical">Historical</option></select></div><div id="txTable">${transactionTable(state.transactions)}</div>`;
  const rerender=()=>{const q=$('txSearch').value.toLowerCase(),cat=$('txCategory').value,st=$('txStatus').value;const rows=state.transactions.filter(t=>(!q||t.description.toLowerCase().includes(q))&&(!cat||t.main_category===cat)&&(!st||t.classification_status===st));$('txTable').innerHTML=transactionTable(rows);bindEditButtons();};['txSearch','txCategory','txStatus'].forEach(id=>$(id).addEventListener('input',rerender));bindEditButtons();
}
function renderReview(){els.reviewView.innerHTML=`<div class="hint"><strong>Only exceptions land here.</strong> When you correct one, the exact and normalized description can be remembered for future files.</div><div style="height:12px"></div>${transactionTable(state.review)}`;bindEditButtons();}

function renderBudget(){
  const all=state.allTransactions||[],mainCats=[...new Set(state.categories.map(c=>c.main_category))].filter(c=>['operating_expense','financial_expense'].includes(defaultMeta(c,'').treatment)).sort();const bmap=new Map(state.budgets.map(b=>[b.main_category,Number(b.amount)]));
  const curRows=rowsBetween(all,monthStart(state.month),nextMonthStart(state.month)),prevYm=addYears(monthStart(state.month),-1).slice(0,7),prevRows=rowsBetween(all,monthStart(prevYm),nextMonthStart(prevYm));const curMap=new Map(categorySpend(curRows,true)),prevMap=new Map(categorySpend(prevRows,true));
  const now=new Date(),isCurrent=state.month===currentMonth(),elapsed=isCurrent?Math.min(now.getUTCDate(),daysInMonth(state.month)):daysInMonth(state.month),days=daysInMonth(state.month);
  els.budgetView.innerHTML=`<div class="card"><div class="card-head"><div><div class="section-kicker">Plan vs actual</div><h2>${esc(monthLabel(state.month))} budget</h2></div><span class="pill">${isCurrent?`Day ${elapsed} / ${days}`:'Closed period'}</span></div><div class="budget-header"><span>Category</span><span>Budget</span><span>Actual</span><span>Forecast</span><span>Prior year</span><span>Variance</span></div><div id="budgetRows">${mainCats.map(c=>{const actual=curMap.get(c)||0,budget=bmap.get(c)||0,forecast=isCurrent&&elapsed?actual/elapsed*days:actual,prior=prevMap.get(c)||0,variance=forecast-budget;return `<div class="budget-row pro"><strong>${esc(c.replaceAll('_',' '))}</strong><input type="number" min="0" step="100" data-budget-cat="${esc(c)}" value="${budget||''}" placeholder="0"><div>${fmtSEK.format(actual)}</div><div>${fmtSEK.format(forecast)}</div><div class="muted">${fmtSEK.format(prior)}</div><div class="${budget?(variance>0?'negative':'positive'):''}">${budget?`${variance>=0?'+':''}${fmtSEK.format(variance)}`:'—'}</div></div>`;}).join('')||'<div class="empty">Import classified history first.</div>'}</div><div class="budget-footer"><button id="saveBudgets" class="primary">Save budget</button><span class="muted small">Forecast is simple day-of-month run-rate for the current month; historical months show actual.</span></div></div>`;$('saveBudgets')?.addEventListener('click',saveBudgets);
}
async function saveBudgets(){const rows=[...document.querySelectorAll('[data-budget-cat]')].map(i=>({owner_id:state.user.id,month:monthStart(state.month),main_category:i.dataset.budgetCat,amount:asNumber(i.value),updated_at:new Date().toISOString()}));const {error}=await supabase.from('budgets').upsert(rows,{onConflict:'owner_id,month,main_category'});if(error)return toast(error.message);toast('Budget saved');await loadMonthData();renderBudget();}

function canonicalCategory(main,sub){
  let m=String(main||'').trim(),s=String(sub||'').trim();if(['','#N/A','.','0'].includes(m))return {main:null,sub:null};
  if(m==='Amazon Cykelgrejjer'){m='Sport_Activities';s='Sporting Equipment';}
  const fixes={lunch:'Lunch',dinner:'Dinner',clothing:'Clothing'};if(fixes[s])s=fixes[s];return {main:m,sub:s||null};
}
function renderImport(){
  els.importView.innerHTML=`<div class="card import-card"><div class="card-head"><div><div class="section-kicker">Transaction ingestion</div><h2>Import Excel or CSV</h2></div></div><p class="muted">Your historical category and subcategory labels remain authoritative. Transfers, redistributions, extraordinary items and reimbursables are handled separately in the analytics rather than being reclassified.</p><div class="info"><strong>Important:</strong> this version detects whether debit columns are stored as negative or positive. Your consolidated workbook uses negative debits, so expenses will import with the correct sign.</div><div style="height:14px"></div><div id="dropZone" class="import-drop"><strong>Drop XLSX, XLSM or CSV here</strong><p class="muted">or choose a file</p><input id="filePicker" type="file" accept=".xlsx,.xlsm,.xls,.csv" /></div><div id="importStatus" class="import-status hidden"></div></div>`;
  const dz=$('dropZone'),picker=$('filePicker');['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>{const f=e.dataTransfer.files?.[0];if(f)importFile(f)});picker.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importFile(f)});
}
function setImportStatus(msg){const s=$('importStatus');if(!s)return;s.classList.remove('hidden');s.textContent=msg;}
function buildHistoricalRuleCandidates(rows){
  const buckets=new Map();const add=(type,key,row)=>{if(!key||!row.main_category)return;const bk=`${type}\u0000${key}`;if(!buckets.has(bk))buckets.set(bk,{type,key,total:0,counts:new Map()});const b=buckets.get(bk);b.total++;const ck=`${row.main_category}\u0000${row.subcategory||''}`;b.counts.set(ck,(b.counts.get(ck)||0)+1);};
  for(const r of rows.filter(x=>x.main_category)){add('exact',r.description.trim().toUpperCase(),r);add('normalized',r.normalized_description,r);}const result=[];
  for(const b of buckets.values()){const [winner,count]=[...b.counts.entries()].sort((a,c)=>c[1]-a[1])[0],[main,sub]=winner.split('\u0000'),confidence=count/b.total,threshold=b.type==='exact'?(b.total>=2&&confidence>=.95):(b.total>=3&&confidence>=.97);result.push({match_type:b.type,match_value:b.key,main_category:main,subcategory:sub,historical_count:b.total,confidence,source:'historical',auto_apply:threshold});}return result;
}
async function fetchRulesMap(){const all=[];let from=0,page=1000;while(true){const {data,error}=await supabase.from('classification_rules').select('*').range(from,from+page-1);if(error)throw error;all.push(...(data||[]));if(!data||data.length<page)break;from+=page;}const exact=new Map(),normalized=new Map();for(const r of all)if(r.auto_apply)(r.match_type==='exact'?exact:normalized).set(r.match_value,r);return {exact,normalized};}
async function classifyUnlabelled(rows){const maps=await fetchRulesMap();for(const r of rows){if(r.main_category)continue;const exact=maps.exact.get(r.description.trim().toUpperCase()),norm=maps.normalized.get(r.normalized_description),rule=exact||norm;if(rule){r.main_category=rule.main_category;r.subcategory=rule.subcategory||null;r.classification_status='auto';r.classification_confidence=Number(rule.confidence);}}}
async function bulkUpsert(table,rows,onConflict,chunk=400,ignoreDuplicates=true){let done=0;for(let i=0;i<rows.length;i+=chunk){const part=rows.slice(i,i+chunk),{error}=await supabase.from(table).upsert(part,{onConflict,ignoreDuplicates});if(error)throw error;done+=part.length;setImportStatus(`Working… ${done.toLocaleString('sv-SE')} / ${rows.length.toLocaleString('sv-SE')}`);}}
async function importFile(file){
  try{setImportStatus('Reading file…');const buf=await file.arrayBuffer(),parsed=parseWorkbook(buf,file.name);let rows=parsed.rows;if(!rows.length)throw new Error('No transaction rows found.');
    for(const r of rows){const c=canonicalCategory(r.main_category,r.subcategory);r.main_category=c.main;r.subcategory=c.sub;r.classification_status=c.main?r.classification_status:'needs_review';r.classification_confidence=c.main?r.classification_confidence:null;}
    setImportStatus(`Found ${rows.length.toLocaleString('sv-SE')} transactions on “${parsed.sheetName}”.\nDebit convention: ${parsed.debitNegative?'negative debits detected':'positive debits detected'}.\nClassifying new rows…`);await classifyUnlabelled(rows);
    setImportStatus(`Preparing ${rows.length.toLocaleString('sv-SE')} rows…`);for(const r of rows){r.owner_id=state.user.id;r.fingerprint=await sha256(r.fingerprint_seed);delete r.fingerprint_seed;}
    setImportStatus('Uploading transactions…');await bulkUpsert('transactions',rows,'owner_id,fingerprint',350,true);
    const labelled=rows.filter(r=>r.main_category&&r.classification_status==='historical');if(labelled.length){
      setImportStatus('Building category index…');const catMap=new Map();for(const r of labelled)catMap.set(`${r.main_category}\u0000${r.subcategory||''}`,{owner_id:state.user.id,main_category:r.main_category,subcategory:r.subcategory||''});const catRows=[...catMap.values()];await bulkUpsert('categories',catRows,'owner_id,main_category,subcategory',400,true);
      setImportStatus('Setting accounting treatments…');const settings=catRows.map(c=>{const m=defaultMeta(c.main_category,c.subcategory);return {owner_id:state.user.id,main_category:c.main_category,subcategory:c.subcategory,pnl_treatment:m.treatment,spend_profile:m.profile,updated_at:new Date().toISOString()};});await bulkUpsert('category_settings',settings,'owner_id,main_category,subcategory',400,true);
      setImportStatus('Building historical classification rules…');const rules=buildHistoricalRuleCandidates(labelled).map(r=>({...r,owner_id:state.user.id,updated_at:new Date().toISOString()}));await bulkUpsert('classification_rules',rules,'owner_id,match_type,match_value',350,true);
    }
    invalidateTransactions();await refreshBaseData();state.month=await determineLatestMonth();els.monthPicker.value=state.month;const auto=rows.filter(r=>r.classification_status==='auto').length,review=rows.filter(r=>r.classification_status==='needs_review').length,hist=rows.filter(r=>r.classification_status==='historical').length;setImportStatus(`Import complete.\n${hist.toLocaleString('sv-SE')} historical classified rows\n${auto.toLocaleString('sv-SE')} automatically classified rows\n${review.toLocaleString('sv-SE')} rows need review`);toast('Import complete');
  }catch(e){console.error(e);setImportStatus(`Import failed: ${e.message}`);}
}

function bindEditButtons(){document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.edit)));}
async function openEdit(id){let t=state.transactions.find(x=>x.id===id)||state.review.find(x=>x.id===id);if(!t){const {data}=await supabase.from('transactions').select('*').eq('id',id).single();t=data;}if(!t)return;state.editingId=id;els.editTransactionSummary.innerHTML=`<strong>${esc(t.description)}</strong><br>${esc(t.transaction_date)} · ${fmtSEK.format(Number(t.amount))}`;const mainCats=[...new Set(state.categories.map(c=>c.main_category))].sort();els.editMainCategory.innerHTML=`<option value="">Choose…</option>${mainCats.map(c=>`<option ${c===t.main_category?'selected':''}>${esc(c)}</option>`).join('')}`;populateSubcategories(t.main_category,t.subcategory);els.rememberRule.checked=true;els.editDialog.showModal();}
function populateSubcategories(main,selected=''){const subs=[...new Set(state.categories.filter(c=>c.main_category===main).map(c=>c.subcategory).filter(Boolean))].sort();els.editSubcategory.innerHTML=`<option value="">None</option>${subs.map(s=>`<option ${s===selected?'selected':''}>${esc(s)}</option>`).join('')}`;}
async function saveEdit(e){
  e.preventDefault();if(!state.editingId)return;const main=els.editMainCategory.value,sub=els.editSubcategory.value;if(!main)return toast('Choose a category');const {data:t,error:fetchErr}=await supabase.from('transactions').select('*').eq('id',state.editingId).single();if(fetchErr)return toast(fetchErr.message);const {error}=await supabase.from('transactions').update({main_category:main,subcategory:sub||null,classification_status:'manual',classification_confidence:1}).eq('id',state.editingId);if(error)return toast(error.message);
  await supabase.from('categories').upsert({owner_id:state.user.id,main_category:main,subcategory:sub||''},{onConflict:'owner_id,main_category,subcategory'});const dm=defaultMeta(main,sub);await supabase.from('category_settings').upsert({owner_id:state.user.id,main_category:main,subcategory:sub||'',pnl_treatment:dm.treatment,spend_profile:dm.profile,updated_at:new Date().toISOString()},{onConflict:'owner_id,main_category,subcategory',ignoreDuplicates:true});
  if(els.rememberRule.checked){const now=new Date().toISOString(),rules=[{owner_id:state.user.id,match_type:'exact',match_value:t.description.trim().toUpperCase(),main_category:main,subcategory:sub||'',historical_count:1,confidence:1,source:'manual',auto_apply:true,updated_at:now},{owner_id:state.user.id,match_type:'normalized',match_value:t.normalized_description||normalizeDescription(t.description),main_category:main,subcategory:sub||'',historical_count:1,confidence:1,source:'manual',auto_apply:true,updated_at:now}];await supabase.from('classification_rules').upsert(rules,{onConflict:'owner_id,match_type,match_value'});}
  els.editDialog.close();state.editingId=null;invalidateTransactions();await refreshBaseData();toast('Classification saved');await switchView(state.currentView);
}

els.authForm?.addEventListener('submit',async e=>{e.preventDefault();setMessage('Signing in…');const {error}=await supabase.auth.signInWithPassword({email:els.authEmail.value,password:els.authPassword.value});setMessage(error?.message||'');});
els.signUpButton?.addEventListener('click',async()=>{setMessage('Creating account…');const {data,error}=await supabase.auth.signUp({email:els.authEmail.value,password:els.authPassword.value});setMessage(error?.message||(data.session?'Account created.':'Account created. If email confirmation is enabled, confirm the email and then sign in.'));});
els.signOutButton?.addEventListener('click',()=>supabase.auth.signOut());
els.monthPicker?.addEventListener('change',async()=>{state.month=els.monthPicker.value;await switchView(state.currentView);});
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
els.editMainCategory?.addEventListener('change',()=>populateSubcategories(els.editMainCategory.value));els.editForm?.addEventListener('submit',saveEdit);$('cancelEditButton')?.addEventListener('click',()=>{els.editDialog.close();state.editingId=null;});

await authInit();
