/**
 * Stock Trainer - 美股模拟交易 (手机版)
 * 数据源：本地后端 API（富途牛牛数据）
 */

// ===== 科技股池（纳斯达克100 + 标普500科技 + 热门科技股）=====
// 已排除: 中概股、医疗健康、保险、传统金融、能源、材料、消费、工业
// 市值过滤: 近3年每年市值都 > $100亿
const US_STOCKS = [
    // === NASDAQ 100 核心科技巨头 ===
    {code:'AAPL',name:'苹果',mkt:105},{code:'MSFT',name:'微软',mkt:105},
    {code:'GOOGL',name:'谷歌A',mkt:105},{code:'GOOG',name:'谷歌C',mkt:105},
    {code:'AMZN',name:'亚马逊',mkt:105},{code:'META',name:'Meta',mkt:105},
    {code:'NVDA',name:'英伟达',mkt:105},{code:'AMD',name:'AMD',mkt:105},
    {code:'INTC',name:'英特尔',mkt:105},{code:'AVGO',name:'博通',mkt:105},
    {code:'ADBE',name:'Adobe',mkt:105},{code:'CSCO',name:'思科',mkt:105},
    {code:'QCOM',name:'高通',mkt:105},{code:'TXN',name:'德州仪器',mkt:105},
    {code:'ORCL',name:'甲骨文',mkt:105},{code:'CRM',name:'Salesforce',mkt:105},
    {code:'NOW',name:'ServiceNow',mkt:105},{code:'INTU',name:'Intuit',mkt:105},
    {code:'MU',name:'美光',mkt:105},{code:'AMAT',name:'应用材料',mkt:105},
    {code:'ADI',name:'亚德诺',mkt:105},{code:'LRCX',name:'泛林',mkt:105},
    {code:'NXPI',name:'恩智浦',mkt:105},{code:'MCHP',name:'微芯',mkt:105},
    {code:'MRVL',name:'迈威尔',mkt:105},{code:'KLAC',name:'KLA',mkt:105},
    {code:'ANET',name:'Arista',mkt:105},{code:'ON',name:'安森美',mkt:105},
    // === S&P 500 信息技术 ===
    {code:'IBM',name:'IBM',mkt:106},{code:'ACN',name:'埃森哲',mkt:106},
    {code:'CTSH',name:'Cognizant',mkt:105},{code:'IT',name:'Gartner',mkt:105},
    {code:'KEYS',name:'Keysight',mkt:106},{code:'TER',name:'Teradyne',mkt:106},
    {code:'STX',name:'希捷',mkt:106},{code:'WDC',name:'西部数据',mkt:106},
    {code:'NTAP',name:'NetApp',mkt:106},{code:'HPQ',name:'惠普',mkt:106},
    {code:'HPE',name:'慧与',mkt:106},{code:'FFIV',name:'F5',mkt:106},
    {code:'PANW',name:'Palo Alto',mkt:105},{code:'FTNT',name:'Fortinet',mkt:105},
    {code:'SNPS',name:'Synopsys',mkt:105},{code:'CDNS',name:'Cadence',mkt:105},
    {code:'WDAY',name:'Workday',mkt:105},
    // === 网络平台 / 互联网科技 ===
    {code:'TSLA',name:'特斯拉',mkt:105},{code:'NFLX',name:'奈飞',mkt:105},
    {code:'UBER',name:'Uber',mkt:105},{code:'ABNB',name:'Airbnb',mkt:105},
    {code:'SHOP',name:'Shopify',mkt:105},{code:'PYPL',name:'PayPal',mkt:105},
    {code:'DASH',name:'DoorDash',mkt:105},{code:'ROKU',name:'Roku',mkt:105},
    {code:'SPOT',name:'Spotify',mkt:105},
    // === 云计算 / SaaS ===
    {code:'SNOW',name:'Snowflake',mkt:105},{code:'DDOG',name:'Datadog',mkt:105},
    {code:'TEAM',name:'Atlassian',mkt:105},{code:'MDB',name:'MongoDB',mkt:105},
    {code:'OKTA',name:'Okta',mkt:105},{code:'CRWD',name:'CrowdStrike',mkt:105},
    {code:'PLTR',name:'Palantir',mkt:105},{code:'NET',name:'Cloudflare',mkt:105},
    {code:'GTLB',name:'GitLab',mkt:105},
    {code:'BILL',name:'Bill.com',mkt:105},
    {code:'ZS',name:'Zscaler',mkt:105},
    {code:'APP',name:'AppLovin',mkt:105},
    {code:'ESTC',name:'Elastic',mkt:105},
    // === 半导体扩展 ===
    {code:'TSM',name:'台积电',mkt:106},
    {code:'ARM',name:'ARM',mkt:105},{code:'MPWR',name:'Monolithic Power',mkt:105},
    {code:'ALAB',name:'Astera Labs',mkt:105},
    // === 硬件 / 服务器 ===
    {code:'DELL',name:'戴尔',mkt:106},
    // === 金融科技 ===
    {code:'HOOD',name:'Robinhood',mkt:105},
    // === 游戏 / 元宇宙 ===
    {code:'RBLX',name:'Roblox',mkt:105},
    // === AI / 量子 / 太空热门科技 ===
    {code:'RKLB',name:'Rocket Lab',mkt:105},
];

// ===== 游戏状态 =====
const INITIAL_CAPITAL = 100000;
const state = {
    historyKlines: [],
    tradingKlines: [],
    currentDay: 0,
    tradingDays: 150,
    initialCash: INITIAL_CAPITAL,
    cash: INITIAL_CAPITAL,
    shares: 0,
    avgCost: 0,
    trades: [],
    gameOver: false,
    stockCode: '',
    stockName: '',
    dataSource: '',
    dateToLabelMap: {},
    revealed: false,
    stockMkt: 0,
    earningsEvents: [],
    stopLossPrice: null,
};

let cumulative = loadCumulative();
let chart = null;
let candleSeries = null;
let volumeSeries = null;
let volMA5Series = null;
let volMA20Series = null;
let volMA50Series = null;
let stopLossPriceLine = null;

// ===== 划线画图系统 =====
const SVG_NS = 'http://www.w3.org/2000/svg';
let drawingMode = false;
let activeTool = 'select';   // 'select' 或具体工具名
let drawings = [];           // {id, type, points:[{time,price}], style:{color,width,dash}, text?}
let selectedId = null;
let magnetMode = true;       // 磁吸默认开启（吸附OHLC）
let nextDrawId = 1;
let drawGesture = null;      // {mode:'draw'|'brush'|'handle'|'move', ...}
let pendingDrawing = null;   // 绘制中 / 等待后续点的画线
let pendingChannel = false;  // 平行通道等待第3个点

const FUTU_COLORS = ['#F23645', '#0ECB81', '#2F6BFF', '#FF9800', '#AB47BC', '#00BCD4', '#FFD60A', '#E6EDF3'];
const FIB_LEVELS = [
    { level: 0,     pct: '0.0%' },
    { level: 0.236, pct: '23.6%' },
    { level: 0.382, pct: '38.2%' },
    { level: 0.5,   pct: '50.0%' },
    { level: 0.618, pct: '61.8%' },
    { level: 0.786, pct: '78.6%' },
    { level: 1.0,   pct: '100.0%' },
];
const DASH_MAP = { solid: null, dashed: '6,4', dotted: '1.5,3.5' };

// 工具栏图标（SVG, 24x24）
const DT_ICON = (inner) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const DRAW_TOOLS = [
    { id: 'select',         name: '选择',   icon: DT_ICON('<path d="M6 3l12 9.5-6.5.8L9 20z" fill="currentColor" stroke="none"/>') },
    { id: 'trendline',      name: '趋势线', icon: DT_ICON('<line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="4" r="1.6" fill="currentColor" stroke="none"/>') },
    { id: 'horizontalline', name: '水平线', icon: DT_ICON('<line x1="3" y1="12" x2="21" y2="12"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>') },
    { id: 'verticalline',   name: '垂直线', icon: DT_ICON('<line x1="12" y1="3" x2="12" y2="21"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>') },
    { id: 'ray',            name: '射线',   icon: DT_ICON('<circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none"/><line x1="8" y1="12" x2="21" y2="12"/>') },
    { id: 'straightline',   name: '直线',   icon: DT_ICON('<line x1="3" y1="20" x2="21" y2="4"/>') },
    { id: 'rectangle',      name: '矩形',   icon: DT_ICON('<rect x="4" y="7" width="16" height="10" rx="1"/>') },
    { id: 'channel',        name: '通道',   icon: DT_ICON('<line x1="3" y1="18" x2="17" y2="7"/><line x1="7" y1="21" x2="21" y2="10"/>') },
    { id: 'arrow',          name: '箭头',   icon: DT_ICON('<line x1="5" y1="19" x2="19" y2="5"/><path d="M12 5h7v7"/>') },
    { id: 'fibonacci',      name: '黄金分割', icon: DT_ICON('<line x1="5" y1="5" x2="19" y2="5"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="5" y1="20" x2="19" y2="20"/>') },
    { id: 'brush',          name: '画笔',   icon: DT_ICON('<path d="M4 18c3 1.5 5-4 8-3s2 5 8 2"/>') },
    { id: 'text',           name: '文字',   icon: DT_ICON('<path d="M5 7V4h14v3M12 4v16M9 20h6"/>') },
];
const DT_ACTIONS = [
    { id: 'magnet', name: '磁吸', icon: DT_ICON('<path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 3h4v8a2 2 0 0 0 4 0V3h4"/>'), act: 'toggleMagnet()' },
    { id: 'undo',   name: '撤销', icon: DT_ICON('<path d="M8 5L4 9l4 4"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'), act: 'undoDrawing()' },
    { id: 'clear',  name: '清空', icon: DT_ICON('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'), act: 'clearDrawings()' },
];

// ===== 数据层：本地后端 API（富途牛牛数据）=====

function tsToDate(ts) {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function round2(n) { return Math.round(n * 100) / 100; }

function formatVolume(vol) {
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
    return String(vol);
}

// ===== 本地后端 API =====
const API_BASE = window.location.origin;  // 同源部署，或设为 'http://localhost:8765'

// 本地后端数据获取
async function fetchLocalKline(code) {
    try {
        const resp = await fetch(`${API_BASE}/api/kline?code=${code}`);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.error || !data.klines || data.klines.length < 200) return null;
        return data;
    } catch (e) { return null; }
}

// 从本地索引获取股票列表
async function fetchLocalStockList() {
    try {
        const resp = await fetch(`${API_BASE}/api/stock_list`);
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) { return null; }
}

function parseLocalKline(data, code) {
    if (!data || !data.klines) return null;
    const klines = [];
    for (const k of data.klines) {
        klines.push({
            date: k.t,
            open: round2(k.o),
            close: round2(k.c),
            high: round2(k.h),
            low: round2(k.l),
            volume: k.v || 0,
            turnover: 0
        });
    }
    if (klines.length < 200) return null;
    return { name: data.name || code, klines, source: 'futu' };
}

async function fetchStockData(code, market) {
    const data = await fetchLocalKline(code);
    if (!data) return null;
    return parseLocalKline(data, code);
}

// 市值估算（基于最近收盘价 × 平均比例）
async function fetchMarketCap(code, market) {
    // 本地模式：从K线数据估算（基于科技股平均市值范围）
    const data = await fetchLocalKline(code);
    if (!data || !data.klines || data.klines.length === 0) return null;
    const lastClose = data.klines[data.klines.length - 1].c;
    // 对于大部分科技股，粗略估算：市值约 = 收盘价 × 1~5亿股
    // 返回 null 表示无法准确获取，走跳过逻辑（不过滤市值）
    return null;
}

// ===== 财报日期获取 =====
function getMarketSuffix(mkt) {
    return mkt === 106 ? 'N' : 'O';
}

async function fetchEarningsDates(code, mkt) {
    // 财报数据仍用东方财富 API
    const suffixes = [getMarketSuffix(mkt), getMarketSuffix(mkt) === 'O' ? 'N' : 'O'];
    
    for (const suffix of suffixes) {
        const secucode = `${code}.${suffix}`;
        const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_USF10_FN_GMAININDICATOR&columns=SECUCODE,NOTICE_DATE,REPORT_TYPE,DATE_TYPE&filter=(SECUCODE=%22${secucode}%22)&pageSize=100&sortColumns=NOTICE_DATE&sortTypes=-1&source=INTLSECURITIES&client=PC`;
        try {
            const resp = await fetch(url);
            const json = await resp.json();
            if (!json || !json.success || !json.result || !json.result.data || json.result.data.length === 0) continue;
            const earnings = [];
            const seenDates = new Set();
            for (const item of json.result.data) {
                if (!item.NOTICE_DATE) continue;
                const date = String(item.NOTICE_DATE).substring(0, 10);
                if (seenDates.has(date)) continue;
                seenDates.add(date);
                earnings.push({
                    date: date,
                    type: item.REPORT_TYPE || '财报',
                    desc: item.DATE_TYPE || '',
                });
            }
            return earnings;
        } catch (e) {
            continue;
        }
    }
    return [];
}

function matchEarningsToTradingDays(earnings, tradingKlines) {
    const matched = [];
    if (!tradingKlines || tradingKlines.length === 0) return matched;
    const firstDate = tradingKlines[0].date;
    const lastDate = tradingKlines[tradingKlines.length - 1].date;
    for (const e of earnings) {
        if (e.date >= firstDate && e.date <= lastDate) {
            let dayIdx = -1;
            for (let i = 0; i < tradingKlines.length; i++) {
                if (tradingKlines[i].date >= e.date) { dayIdx = i; break; }
            }
            if (dayIdx === -1) dayIdx = tradingKlines.length - 1;
            matched.push({ ...e, tradingDayIndex: dayIdx });
        }
    }
    return matched.sort((a, b) => a.tradingDayIndex - b.tradingDayIndex);
}

function updateEarningsReminder() {
    const el = document.getElementById('earningsBanner');
    if (!el) return;
    if (state.gameOver || state.revealed || state.earningsEvents.length === 0) {
        el.style.display = 'none';
        return;
    }
    let nextEarnings = null;
    for (const e of state.earningsEvents) {
        const daysUntil = e.tradingDayIndex - state.currentDay;
        if (daysUntil >= 0 && daysUntil <= 7) { nextEarnings = { ...e, daysUntil }; break; }
    }
    if (!nextEarnings) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    if (nextEarnings.daysUntil === 0) {
        el.className = 'earnings-banner earnings-today';
        el.innerHTML = `<span class="earnings-icon">📢</span><span>今日财报发布 · ${nextEarnings.type}</span>`;
    } else {
        el.className = 'earnings-banner earnings-soon';
        el.innerHTML = `<span class="earnings-icon">⚠️</span><span>${nextEarnings.daysUntil}个交易日后财报 · ${nextEarnings.type}</span>`;
    }
}

// ===== 累计统计 =====
function loadCumulative() {
    try {
        const s = localStorage.getItem('stockTrainerCumulative');
        if (s) {
            const data = JSON.parse(s);
            // 数据完整性校验：确保关键字段存在
            if (typeof data.gamesPlayed === 'number' &&
                typeof data.cash === 'number' &&
                typeof data.totalPnL === 'number' &&
                typeof data.originalCash === 'number') {
                // 补全可能缺失的字段
                if (data.bestReturn === undefined || data.bestReturn === null) data.bestReturn = -Infinity;
                if (data.worstReturn === undefined || data.worstReturn === null) data.worstReturn = Infinity;
                return data;
            }
        }
    } catch (e) {}
    return {
        cash: INITIAL_CAPITAL,
        gamesPlayed: 0,
        totalPnL: 0,
        bestReturn: -Infinity,
        worstReturn: Infinity,
        originalCash: INITIAL_CAPITAL,
    };
}

function saveCumulative() {
    try {
        const data = {
            cash: cumulative.cash,
            gamesPlayed: cumulative.gamesPlayed,
            totalPnL: cumulative.totalPnL,
            bestReturn: cumulative.bestReturn === -Infinity ? null : cumulative.bestReturn,
            worstReturn: cumulative.worstReturn === Infinity ? null : cumulative.worstReturn,
            originalCash: cumulative.originalCash,
        };
        localStorage.setItem('stockTrainerCumulative', JSON.stringify(data));
    } catch (e) {}
}

// ===== 初始化 =====
window.addEventListener('DOMContentLoaded', () => {
    cumulative = loadCumulative();
    updateCumulativeUI();
    initDrawOverlay();
    initSlPanelDrag();
    newGame();
});

// ===== 开始新游戏 =====
async function newGame() {
    showLoading(true);
    document.getElementById('gameOverModal').classList.remove('show');
    document.getElementById('skipModal').classList.remove('show');

    const carryCash = cumulative.cash > 0 ? cumulative.cash : INITIAL_CAPITAL;
    const HISTORY_DAYS = 63;
    const TRADING_DAYS = 150;
    const MIN_NEEDED = 213;
    const TOTAL_NEEDED = HISTORY_DAYS + TRADING_DAYS; // 213

    // 本地后端模式：从 API 获取可用股票列表
    let stockList = await fetchLocalStockList();
    if (!stockList || stockList.length === 0) {
        showLoading(false);
        alert('无法连接后端数据服务，请确保后端已启动。');
        return;
    }

    // 随机打乱
    for (let i = stockList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [stockList[i], stockList[j]] = [stockList[j], stockList[i]];
    }

    let found = false;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 8;

    for (const stock of stockList.slice(0, 80)) {
        const result = await fetchStockData(stock.code);

        if (!result || result.klines.length < MIN_NEEDED) {
            consecutiveFailures++;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break;
            continue;
        }
        consecutiveFailures = 0;
        const total = result.klines.length;
        const historyCount = Math.min(HISTORY_DAYS, total - TRADING_DAYS);
        const totalNeeded = historyCount + TRADING_DAYS;
        // 在近3年数据范围内随机选择起始位置
        const maxStart = Math.max(0, total - totalNeeded);
        const startIdx = maxStart > 0 ? Math.floor(Math.random() * (maxStart + 1)) : 0;

        const selected = result.klines.slice(startIdx, startIdx + totalNeeded);
        let historyKlines = selected.slice(0, historyCount);
        let tradingKlines = selected.slice(historyCount);

        if (tradingKlines.length < TRADING_DAYS) {
            const shortage = TRADING_DAYS - tradingKlines.length;
            historyKlines = selected.slice(0, historyCount - shortage);
            tradingKlines = selected.slice(historyCount - shortage);
        }

        state.historyKlines = historyKlines;
        state.tradingKlines = tradingKlines;
        state.stockCode = stock.code;
        state.stockName = result.name || stock.name;
        state.dataSource = 'futu';
        state.tradingDays = TRADING_DAYS;
        state.initialCash = Math.round(carryCash * 100) / 100;
        state.cash = state.initialCash;
        state.currentDay = 0;
        state.shares = 0;
        state.avgCost = 0;
        state.trades = [];
        state.gameOver = false;
        state.revealed = false;
        state.stockMkt = stock.mkt;
        state.earningsEvents = [];
        state.stopLossPrice = null;
        loadDrawingsForStock();

        state.dateToLabelMap = {};
        state.historyKlines.forEach((k, i) => { state.dateToLabelMap[k.date] = `H${i+1}`; });
        state.tradingKlines.forEach((k, i) => { state.dateToLabelMap[k.date] = `D${i+1}`; });

        found = true;
        break;
    }

    showLoading(false);

    if (!found) {
        showToast('获取数据失败，请检查网络后重试', 'error');
        return;
    }

    initChart();
    // 保持画图模式状态
    if (drawingMode && chart) chart.applyOptions({ handleScroll: false, handleScale: false });
    updateChart();
    chart.timeScale().fitContent();
    updateUI();
    updateStockHeader();
    showToast(`历史${state.historyKlines.length}天已展示，${state.tradingDays}个交易日开始！`, 'success');

    // 非阻塞获取财报日期
    fetchEarningsDates(state.stockCode, state.stockMkt).then(earnings => {
        state.earningsEvents = matchEarningsToTradingDays(earnings, state.tradingKlines);
        updateEarningsReminder();
        if (state.earningsEvents.length > 0 && !state.gameOver && !state.revealed) {
            const next = state.earningsEvents.find(e => e.tradingDayIndex >= state.currentDay);
            if (next) {
                setTimeout(() => {
                    showToast(`📊 财报预告: ${next.type}将在 D${next.tradingDayIndex + 1} 发布`, 'info');
                }, 1500);
            }
        }
    });
}

// ===== 股票信息头 =====
function updateStockHeader() {
    const nameEl = document.getElementById('stockName');
    const codeEl = document.getElementById('stockCode');
    const dsEl = document.getElementById('dataSource');

    if (state.revealed) {
        nameEl.textContent = state.stockName;
        codeEl.textContent = state.stockCode;
    } else {
        nameEl.textContent = '???';
        codeEl.textContent = '???';
    }
    dsEl.textContent = '富途牛牛 · 近3年数据';
    dsEl.className = 'data-badge real';
}

// ===== 跳过 =====
let skipBackup = null;

function calculateTradingDays() {
    if (state.trades.length === 0) return 0;
    const firstDay = Math.min(...state.trades.map(t => t.day));
    const lastDay = Math.max(...state.trades.map(t => t.day));
    return lastDay - firstDay + 1;
}

async function skipStock() {
    if (state.gameOver) return;

    // 保存状态以便取消
    skipBackup = {
        cash: state.cash,
        shares: state.shares,
        avgCost: state.avgCost,
        revealed: state.revealed,
        trades: state.trades.map(t => ({ ...t })),
        cumulative: JSON.parse(JSON.stringify(cumulative)),
        stopLossPrice: state.stopLossPrice,
    };

    if (state.shares !== 0) closePosition(true);

    const finalCash = state.cash;
    const gamePnL = finalCash - state.initialCash;
    const gameReturn = state.initialCash > 0 ? (gamePnL / state.initialCash) * 100 : 0;

    cumulative.cash = finalCash > 0 ? finalCash : 0;
    // 跳过不计入已玩局数
    cumulative.totalPnL += gamePnL;
    if (gameReturn > cumulative.bestReturn) cumulative.bestReturn = gameReturn;
    if (gameReturn < cumulative.worstReturn) cumulative.worstReturn = gameReturn;
    saveCumulative();
    updateCumulativeUI();

    const cumPnL = cumulative.cash - cumulative.originalCash;
    const cumReturn = cumulative.originalCash > 0 ? (cumPnL / cumulative.originalCash * 100) : 0;

    state.revealed = true;
    updateStockHeader();
    updateChart();
    // 不调用 fitContent，避免跳过弹窗背后的K线图被压缩到全范围
    updateUI();

    const modal = document.getElementById('skipModal');
    const stockEl = document.getElementById('skipStockInfo');
    const summaryEl = document.getElementById('skipSummary');

    const firstDate = state.historyKlines[0].date;
    const lastDate = state.tradingKlines[state.tradingKlines.length - 1].date;
    const tradingDays = calculateTradingDays();
    const buyTrades = state.trades.filter(t => t.type === 'buy').length;
    const sellTrades = state.trades.filter(t => t.type === 'sell').length;

    const dsLabel = '富途牛牛 · 近3年数据';
    stockEl.innerHTML = `跳过: <strong>${state.stockName} (${state.stockCode})</strong><br>${firstDate} ~ ${lastDate} · ${dsLabel}`;

    summaryEl.innerHTML = `
        <div class="skip-result-row">
            <div class="skip-result-label">本局收益</div>
            <div class="skip-result-val ${gamePnL >= 0 ? 'up' : 'down'}">
                ${gamePnL >= 0 ? '+' : ''}$${gamePnL.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
            </div>
        </div>
        <div class="skip-result-row">
            <div class="skip-result-label">本局收益率</div>
            <div class="skip-result-val ${gameReturn >= 0 ? 'up' : 'down'}">
                ${gameReturn >= 0 ? '+' : ''}${gameReturn.toFixed(2)}%
            </div>
        </div>
        <div class="skip-result-row">
            <div class="skip-result-label">交易时长</div>
            <div class="skip-result-val">${tradingDays > 0 ? tradingDays + ' 个交易日' : '未交易'}</div>
        </div>
        <div class="skip-result-row">
            <div class="skip-result-label">交易次数</div>
            <div class="skip-result-val">${buyTrades + sellTrades} 次 (买${buyTrades}/卖${sellTrades})</div>
        </div>
        <div class="skip-divider"></div>
        <div class="skip-result-row">
            <div class="skip-result-label">累计收益（${state.tradingDays}天）</div>
            <div class="skip-result-val ${cumPnL >= 0 ? 'up' : 'down'}">
                ${cumPnL >= 0 ? '+' : ''}$${cumPnL.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
            </div>
        </div>
        <div class="skip-result-row">
            <div class="skip-result-label">累计收益率</div>
            <div class="skip-result-val ${cumReturn >= 0 ? 'up' : 'down'}">
                ${cumReturn >= 0 ? '+' : ''}${cumReturn.toFixed(2)}%
            </div>
        </div>
        <div class="skip-result-row">
            <div class="skip-result-label">累计资产</div>
            <div class="skip-result-val">$${cumulative.cash.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        </div>
        <div class="skip-result-row">
            <div class="skip-result-label">已玩局数</div>
            <div class="skip-result-val">${cumulative.gamesPlayed} 局</div>
        </div>
    `;
    modal.classList.add('show');
}

function skipCancel() {
    if (!skipBackup) return;
    state.cash = skipBackup.cash;
    state.shares = skipBackup.shares;
    state.avgCost = skipBackup.avgCost;
    state.revealed = skipBackup.revealed;
    state.trades = skipBackup.trades;
    state.stopLossPrice = skipBackup.stopLossPrice;
    cumulative = skipBackup.cumulative;
    saveCumulative();
    updateCumulativeUI();
    skipBackup = null;

    document.getElementById('skipModal').classList.remove('show');
    updateStockHeader();
    updateChart();
    updateUI();
}

async function skipContinue() {
    document.getElementById('skipModal').classList.remove('show');
    await newGame();
}

// ===== 可见K线 =====
function getVisibleKlines() {
    return [...state.historyKlines, ...state.tradingKlines.slice(0, state.currentDay + 1)];
}
function getAllKlines() {
    return [...state.historyKlines, ...state.tradingKlines];
}

// ===== 图表 =====
function initChart() {
    const container = document.getElementById('chartContainer');
    if (chart) chart.remove();

    chart = LightweightCharts.createChart(container, {
        layout: {
            background: { type: 'solid', color: '#0d1117' },
            textColor: '#8b949e',
            fontSize: 11,
        },
        grid: {
            vertLines: { color: '#161b22' },
            horzLines: { color: '#161b22' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: { color: '#30363d', width: 1, style: 2 },
            horzLine: { color: '#30363d', width: 1, style: 2 },
        },
        rightPriceScale: {
            borderColor: '#21262d',
            scaleMargins: { top: 0.05, bottom: 0.25 },
        },
        timeScale: {
            borderColor: '#21262d',
            timeVisible: false,
            rightOffset: 3,
            barSpacing: 5,
            tickMarkFormatter: (time) => {
                if (state.revealed) {
                    if (typeof time === 'string') return time.slice(5);
                    if (time.year) return `${time.month}/${time.day}`;
                    return '';
                }
                const dateStr = typeof time === 'string' ? time :
                    (time.year ? `${time.year}-${String(time.month).padStart(2,'0')}-${String(time.day).padStart(2,'0')}` : '');
                return state.dateToLabelMap[dateStr] || '';
            },
        },
        handleScroll: true,
        handleScale: true,
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#ef4444',
        downColor: '#22c55e',
        borderUpColor: '#ef4444',
        borderDownColor: '#22c55e',
        wickUpColor: '#ef4444',
        wickDownColor: '#22c55e',
        priceLineVisible: false,
    });

    volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        color: '#21262d',
    });
    chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
    });

    // 成交量均线
    volMA5Series = chart.addLineSeries({
        priceScaleId: 'volume',
        color: '#f97316',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Solid,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
    });
    volMA20Series = chart.addLineSeries({
        priceScaleId: 'volume',
        color: '#c084fc',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Solid,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
    });
    volMA50Series = chart.addLineSeries({
        priceScaleId: 'volume',
        color: '#34d399',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Solid,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
    });

    // 十字光标联动成交量均线图例 + 价格tooltip
    chart.subscribeCrosshairMove((param) => {
        updatePriceTooltip(param);
        if (!param.time) {
            const visible = state.revealed ? getAllKlines() : getVisibleKlines();
            updateVolLegend(visible);
            return;
        }
        const v5Data = param.seriesData.get(volMA5Series);
        const v20Data = param.seriesData.get(volMA20Series);
        const v50Data = param.seriesData.get(volMA50Series);
        const v5El = document.getElementById('volMA5Val');
        const v20El = document.getElementById('volMA20Val');
        const v50El = document.getElementById('volMA50Val');
        if (v5El) v5El.textContent = v5Data ? formatVol(v5Data.value) : '—';
        if (v20El) v20El.textContent = v20Data ? formatVol(v20Data.value) : '—';
        if (v50El) v50El.textContent = v50Data ? formatVol(v50Data.value) : '—';
    });

    const ro = new ResizeObserver(() => {
        if (chart && container) {
            chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
            renderDrawings();
        }
    });
    ro.observe(container);

    // 画图联动：图表滚动/缩放时重新渲染画线 + 止损标签
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
        if (drawings.length > 0 || pendingDrawing) renderDrawings();
        if (state.stopLossPrice !== null && state.shares !== 0) updateStopLossLine();
    });

    // 双击放大/还原K线
    const defaultBarSpacing = 5;
    const zoomedBarSpacing = 10;
    let isZoomed = false;
    container.addEventListener('dblclick', (e) => {
        // 不拦截画图模式的双击
        if (drawingMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        isZoomed = !isZoomed;
        const targetSpacing = isZoomed ? zoomedBarSpacing : defaultBarSpacing;
        chart.applyOptions({
            timeScale: { barSpacing: targetSpacing },
        });
        chart.timeScale().fitContent();
        renderDrawings();
    });
}

// ===== 成交量均线计算 =====
function calcVolMA(klines, period) {
    const result = [];
    for (let i = period - 1; i < klines.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += klines[j].volume;
        result.push({ time: klines[i].date, value: sum / period });
    }
    return result;
}

function formatVol(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return v.toFixed(0);
}

function findKlineByTime(time) {
    const timeStr = typeof time === 'string' ? time :
        (time && time.year ? `${time.year}-${String(time.month).padStart(2,'0')}-${String(time.day).padStart(2,'0')}` : '');
    if (!timeStr) return null;
    const allKlines = [...state.historyKlines, ...state.tradingKlines];
    return allKlines.find(k => k.date === timeStr);
}

function getPrevClose(dateStr) {
    const allKlines = [...state.historyKlines, ...state.tradingKlines];
    const idx = allKlines.findIndex(k => k.date === dateStr);
    if (idx <= 0) return null;
    return allKlines[idx - 1].close;
}

function calcDailyChange(kline) {
    if (!kline) return { change: 0, changePct: 0 };
    const prevClose = getPrevClose(kline.date);
    if (prevClose !== null && prevClose > 0) {
        const change = kline.close - prevClose;
        const changePct = (change / prevClose) * 100;
        return { change, changePct };
    }
    // 第一根K线用 open→close
    const change = kline.close - kline.open;
    const changePct = kline.open > 0 ? (change / kline.open) * 100 : 0;
    return { change, changePct };
}

function updatePriceTooltip(param) {
    const tooltip = document.getElementById('priceTooltip');
    if (!tooltip) return;
    if (!param.time) {
        tooltip.style.display = 'none';
        return;
    }
    const kline = findKlineByTime(param.time);
    if (!kline) {
        tooltip.style.display = 'none';
        return;
    }
    tooltip.style.display = 'block';
    const label = state.dateToLabelMap[kline.date] || kline.date.slice(5);
    document.getElementById('ptDate').textContent = label;
    document.getElementById('ptOpen').textContent = kline.open.toFixed(2);
    document.getElementById('ptHigh').textContent = kline.high.toFixed(2);
    document.getElementById('ptLow').textContent = kline.low.toFixed(2);
    document.getElementById('ptClose').textContent = kline.close.toFixed(2);
    document.getElementById('ptVolume').textContent = formatVolume(kline.volume);
    const { change, changePct } = calcDailyChange(kline);
    const sign = change >= 0 ? '+' : '';
    const changeEl = document.getElementById('ptChange');
    changeEl.textContent = `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
    changeEl.style.color = change >= 0 ? 'var(--color-up)' : 'var(--color-down)';
}

function updateVolLegend(visible) {
    if (!visible || visible.length === 0) return;
    const idx = visible.length - 1;
    const v5El = document.getElementById('volMA5Val');
    const v20El = document.getElementById('volMA20Val');
    const v50El = document.getElementById('volMA50Val');
    if (!v5El) return;

    if (idx >= 4) {
        let sum = 0;
        for (let j = idx - 4; j <= idx; j++) sum += visible[j].volume;
        v5El.textContent = formatVol(sum / 5);
    } else v5El.textContent = '—';

    if (idx >= 19) {
        let sum = 0;
        for (let j = idx - 19; j <= idx; j++) sum += visible[j].volume;
        v20El.textContent = formatVol(sum / 20);
    } else v20El.textContent = '—';

    if (idx >= 49) {
        let sum = 0;
        for (let j = idx - 49; j <= idx; j++) sum += visible[j].volume;
        v50El.textContent = formatVol(sum / 50);
    } else v50El.textContent = '—';
}

function updateChart() {
    if (!candleSeries || state.historyKlines.length === 0) return;

    const visible = state.revealed ? getAllKlines() : getVisibleKlines();

    candleSeries.setData(visible.map(k => ({
        time: k.date, open: k.open, high: k.high, low: k.low, close: k.close,
    })));

    volumeSeries.setData(visible.map(k => ({
        time: k.date, value: k.volume,
        color: k.close >= k.open ? 'rgba(239,68,68,0.8)' : 'rgba(34,197,94,0.8)',
    })));

    // 成交量均线
    volMA5Series.setData(calcVolMA(visible, 5));
    volMA20Series.setData(calcVolMA(visible, 20));
    volMA50Series.setData(calcVolMA(visible, 50));

    updateTradeMarkers();
    updateVolLegend(visible);
    renderDrawings();
}

function updateTradeMarkers() {
    if (!candleSeries) return;
    const dayTrades = {};
    state.trades.forEach(t => {
        if (t.day <= state.currentDay) {
            if (!dayTrades[t.day]) dayTrades[t.day] = { buyQty: 0, sellQty: 0 };
            if (t.type === 'buy') dayTrades[t.day].buyQty += t.shares;
            if (t.type === 'sell') dayTrades[t.day].sellQty += t.shares;
        }
    });
    const markers = [];
    for (const [day, dt] of Object.entries(dayTrades)) {
        const kline = state.tradingKlines[parseInt(day)];
        if (!kline) continue;
        if (dt.buyQty > 0) markers.push({ time: kline.date, position: 'belowBar', color: '#ef4444', shape: 'arrowUp', text: 'B' });
        if (dt.sellQty > 0) markers.push({ time: kline.date, position: 'aboveBar', color: '#22c55e', shape: 'arrowDown', text: 'S' });
    }
    markers.sort((a, b) => new Date(a.time) - new Date(b.time));
    candleSeries.setMarkers(markers);
}

// ===== 价格工具 =====
function getCurrentPrice() {
    if (state.currentDay < state.tradingKlines.length) return state.tradingKlines[state.currentDay].close;
    return 0;
}
function getCurrentKline() { return state.tradingKlines[state.currentDay]; }

// ===== 做多 =====
function doLong() {
    if (state.gameOver) return;
    const price = getCurrentPrice();
    if (price <= 0) return;
    const buyAmount = state.cash;
    const qty = Math.floor(buyAmount / price);
    if (!qty || qty <= 0) { showToast('资金不足或比例太小', 'error'); return; }
    const cost = qty * price;
    if (cost > state.cash) { showToast(`资金不足！需要 $${cost.toFixed(2)}，可用 $${state.cash.toFixed(2)}`, 'error'); return; }

    if (state.shares >= 0) {
        const totalCost = state.shares * state.avgCost + cost;
        state.shares += qty;
        state.avgCost = state.shares > 0 ? totalCost / state.shares : 0;
        state.cash -= cost;
    } else {
        const coverQty = Math.min(qty, Math.abs(state.shares));
        const remaining = qty - coverQty;
        state.cash -= coverQty * price;
        state.shares += coverQty;
        if (state.shares === 0) state.avgCost = 0;
        if (remaining > 0) {
            const remCost = remaining * price;
            if (remCost > state.cash) {
                state.trades.push({ day: state.currentDay, type: 'buy', shares: coverQty, price });
                showToast(`资金仅够平空 ${coverQty} 股`, 'warning');
                updateChart(); updateUI(); return;
            }
            state.shares = remaining;
            state.avgCost = price;
            state.cash -= remCost;
        }
    }
    state.trades.push({ day: state.currentDay, type: 'buy', shares: qty, price });
    showToast(`买入 ${qty} 股 @ $${price.toFixed(2)} ($${cost.toFixed(0)})`, 'success');
    updateChart(); updateUI();
}

// ===== 做空 =====
function doShort() {
    if (state.gameOver) return;
    const price = getCurrentPrice();
    if (price <= 0) return;
    const equity = calculateEquity();
    const shortAmount = equity;
    const qty = Math.floor(shortAmount / price);
    if (!qty || qty <= 0) { showToast('资金不足或比例太小', 'error'); return; }
    const newShares = state.shares - qty;
    if (newShares < 0 && Math.abs(newShares) * price > equity) {
        showToast('做空超出限制！', 'error'); return;
    }

    if (state.shares <= 0) {
        const totalQty = Math.abs(state.shares) + qty;
        state.avgCost = (Math.abs(state.shares) * state.avgCost + qty * price) / totalQty;
        state.shares -= qty;
        state.cash += qty * price;
    } else {
        const sellQty = Math.min(qty, state.shares);
        const remaining = qty - sellQty;
        state.cash += sellQty * price;
        state.shares -= sellQty;
        if (state.shares === 0) state.avgCost = 0;
        if (remaining > 0) {
            state.shares = -remaining;
            state.avgCost = price;
            state.cash += remaining * price;
        }
    }
    state.trades.push({ day: state.currentDay, type: 'sell', shares: qty, price });
    showToast(`卖出 ${qty} 股 @ $${price.toFixed(2)} ($${(qty * price).toFixed(0)})`, 'success');
    updateChart(); updateUI();
}

// ===== 平仓 =====
function doClosePosition() { closePosition(false); }

function closePosition(silent) {
    if (state.gameOver) return;
    if (state.shares === 0) { if (!silent) showToast('当前无持仓', 'warning'); return; }
    const price = getCurrentPrice();
    const posShares = state.shares;
    const hadStopLoss = state.stopLossPrice !== null;
    if (posShares > 0) {
        state.cash += posShares * price;
        state.trades.push({ day: state.currentDay, type: 'sell', shares: posShares, price, close: true });
        if (!silent) showToast(`平多 ${posShares} 股 @ $${price.toFixed(2)}`, 'success');
    } else {
        state.cash -= Math.abs(posShares) * price;
        state.trades.push({ day: state.currentDay, type: 'buy', shares: Math.abs(posShares), price, close: true });
        if (!silent) showToast(`平空 ${Math.abs(posShares)} 股 @ $${price.toFixed(2)}`, 'success');
    }
    state.shares = 0;
    state.avgCost = 0;
    state.stopLossPrice = null;
    if (hadStopLoss && !silent) {
        showToast('止损单已自动取消', 'info');
    }
    updateChart(); updateUI();
}

// ===== 止损单 =====
function openStopLossPanel() {
    if (state.gameOver) return;
    if (state.shares === 0) { showToast('当前无持仓，无法设置止损', 'warning'); return; }
    const price = getCurrentPrice();
    const isLong = state.shares > 0;

    const modal = document.getElementById('stopLossModal');
    const infoEl = document.getElementById('slPositionInfo');
    const input = document.getElementById('stopLossInput');
    const quickBtns = document.getElementById('slQuickBtns');
    const cancelBtn = document.getElementById('btnSlCancel');

    infoEl.innerHTML = `
        <span class="pos-tag ${isLong ? 'long' : 'short'}">${isLong ? '做多' : '做空'}</span>
        <span style="color:var(--text-secondary)">${Math.abs(state.shares)}股 · 现价 $${price.toFixed(2)}</span>
    `;

    // 快捷百分比按钮: 1%-10%
    const pcts = isLong
        ? [-0.01, -0.02, -0.03, -0.04, -0.05, -0.06, -0.07, -0.08, -0.09, -0.10]
        : [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10];
    quickBtns.innerHTML = pcts.map(p => {
        const slPrice = round2(price * (1 + p));
        const label = (p > 0 ? '+' : '') + (p * 100).toFixed(0) + '%';
        return `<button class="sl-quick-btn" onclick="document.getElementById('stopLossInput').value=${slPrice};updateSlPreview()">${label}<br><span>$${slPrice.toFixed(2)}</span></button>`;
    }).join('');

    // 预填当前止损价或建议价
    if (state.stopLossPrice) {
        input.value = state.stopLossPrice.toFixed(2);
        cancelBtn.style.display = 'block';
    } else {
        const suggest = round2(price * (isLong ? 0.92 : 1.08));
        input.value = suggest.toFixed(2);
        cancelBtn.style.display = 'none';
    }

    updateSlPreview();
    modal.classList.add('show');
}

function closeStopLossPanel() {
    document.getElementById('stopLossModal').classList.remove('show');
}

function updateSlPreview() {
    const input = document.getElementById('stopLossInput');
    const preview = document.getElementById('slPreview');
    const val = parseFloat(input.value);
    if (!val || val <= 0 || state.shares === 0) { preview.textContent = ''; return; }
    const price = getCurrentPrice();
    const isLong = state.shares > 0;
    const lossPerShare = isLong ? (val - state.avgCost) : (state.avgCost - val);
    const totalLoss = lossPerShare * Math.abs(state.shares);
    const pct = ((val - price) / price * 100);
    const valid = isLong ? val < price : val > price;
    if (!valid) {
        preview.innerHTML = `<span style="color:var(--color-up)">⚠️ 止损价应${isLong ? '低于' : '高于'}现价 $${price.toFixed(2)}</span>`;
        return;
    }
    preview.innerHTML = `触发时${totalLoss >= 0 ? '盈利' : '亏损'} <span style="color:${totalLoss >= 0 ? 'var(--color-up)' : 'var(--color-down)'};font-weight:600">${totalLoss >= 0 ? '+' : ''}$${totalLoss.toFixed(2)}</span> · 距现价 <span style="color:${pct >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;
}

function setStopLoss() {
    const input = document.getElementById('stopLossInput');
    const val = parseFloat(input.value);
    if (!val || val <= 0) { showToast('请输入有效的止损价格', 'error'); return; }
    const price = getCurrentPrice();
    const isLong = state.shares > 0;
    if (isLong && val >= price) { showToast('做多止损价应低于现价', 'error'); return; }
    if (!isLong && val <= price) { showToast('做空止损价应高于现价', 'error'); return; }

    state.stopLossPrice = round2(val);
    closeStopLossPanel();
    showToast(`止损单已设置 @ $${state.stopLossPrice.toFixed(2)}`, 'success');
    updateUI();
}

function cancelStopLoss() {
    state.stopLossPrice = null;
    closeStopLossPanel();
    showToast('止损单已取消', 'info');
    updateUI();
}

// ===== 下一天 =====
function nextDay() {
    if (state.gameOver) return;
    state.currentDay++;
    if (state.currentDay >= state.tradingDays) { endGame(`${state.tradingDays}个交易日已结束`); return; }

    // 止损单检查
    if (state.stopLossPrice !== null && state.shares !== 0) {
        const kline = state.tradingKlines[state.currentDay];
        const isLong = state.shares > 0;
        const triggered = isLong ? (kline.low <= state.stopLossPrice) : (kline.high >= state.stopLossPrice);
        if (triggered) {
            // 开盘价是否已跳空超过止损价：是→以开盘价结算；否→以止损价结算
            const gappedThrough = isLong ? (kline.open <= state.stopLossPrice) : (kline.open >= state.stopLossPrice);
            const slPrice = gappedThrough ? kline.open : state.stopLossPrice;
            const priceLabel = gappedThrough ? '开盘价' : '止损价';
            const posShares = state.shares;
            if (isLong) {
                state.cash += posShares * slPrice;
                state.trades.push({ day: state.currentDay, type: 'sell', shares: posShares, price: slPrice, close: true, stopLoss: true });
            } else {
                state.cash -= Math.abs(posShares) * slPrice;
                state.trades.push({ day: state.currentDay, type: 'buy', shares: Math.abs(posShares), price: slPrice, close: true, stopLoss: true });
            }
            const pnl = isLong ? (slPrice - state.avgCost) * posShares : (state.avgCost - slPrice) * Math.abs(posShares);
            state.shares = 0;
            state.avgCost = 0;
            state.stopLossPrice = null;
            showToast(`🔴 止损触发！${isLong ? '平多' : '平空'} ${Math.abs(posShares)}股 @ ${priceLabel}$${slPrice.toFixed(2)} ${pnl >= 0 ? '盈利' : '亏损'} $${Math.abs(pnl).toFixed(2)}`, 'warning');
        }
    }

    const equity = calculateEquity();
    if (equity <= 0) { endGame('爆仓了！'); return; }

    // 财报日提醒
    const earningsToday = state.earningsEvents.find(e => e.tradingDayIndex === state.currentDay);
    if (earningsToday) {
        showToast(`📢 今日财报发布日: ${earningsToday.type}`, 'warning');
    }

    updateChart(); updateUI();

    // 视图跟随：滚动到最新交易日K线
    if (chart) chart.timeScale().scrollToRealTime();
}
function calculateEquity() {
    const px = state.currentDay < state.tradingKlines.length ? getCurrentPrice() : 0;
    // 越界时（终局），按最后一天 close 计算真实权益
    const price = px || (state.tradingKlines.length > 0 ? state.tradingKlines[state.tradingKlines.length - 1].close : 0);
    return state.cash + state.shares * price;
}
function calculateUnrealizedPnL() {
    if (state.shares === 0) return 0;
    const px = state.currentDay < state.tradingKlines.length ? getCurrentPrice() : state.tradingKlines[state.tradingKlines.length - 1].close;
    return state.shares * (px - state.avgCost);
}
function calculateTotalPnL() { return calculateEquity() - state.initialCash; }

// ===== UI 更新 =====
function updateUI() {
    const price = getCurrentPrice();
    const kline = getCurrentKline();
    const equity = calculateEquity();
    const totalPnL = calculateTotalPnL();
    const returnRate = (totalPnL / state.initialCash) * 100;

    document.getElementById('totalEquity').textContent = `$${equity.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
    document.getElementById('pnlValue').textContent = `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
    document.getElementById('pnlValue').className = 'acct-value ' + (totalPnL >= 0 ? 'up' : 'down');
    document.getElementById('returnRate').textContent = `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}%`;
    document.getElementById('returnRate').className = 'acct-value ' + (returnRate >= 0 ? 'up' : 'down');
    document.getElementById('dayCounter').textContent = `${Math.min(state.currentDay + 1, state.tradingDays)}/${state.tradingDays}`;
    document.getElementById('currentPrice').textContent = `$${price.toFixed(2)}`;

    if (kline) {
        const { change, changePct } = calcDailyChange(kline);
        const sign = change >= 0 ? '+' : '';
        document.getElementById('priceChange').textContent = `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
        document.getElementById('priceChange').style.color = change >= 0 ? 'var(--color-up)' : 'var(--color-down)';
    }

    updatePositionBar();
    document.getElementById('btnLong').disabled = state.gameOver;
    document.getElementById('btnShort').disabled = state.gameOver;
    document.getElementById('btnClose').disabled = state.shares === 0 || state.gameOver;
    document.getElementById('btnNext').disabled = state.gameOver;
    document.getElementById('btnSkip').disabled = state.gameOver;

    updateTradeEstimate();
    updateTradeHistory();
    updateEarningsReminder();
}

function updateCumulativeUI() {
    const el = document.getElementById('cumulativeStats');
    if (!el) return;
    const cumPnL = cumulative.cash - cumulative.originalCash;
    const cumReturn = cumulative.originalCash > 0 ? (cumPnL / cumulative.originalCash * 100) : 0;
    el.innerHTML = `
        <span class="cum-item">第<strong>${cumulative.gamesPlayed + 1}</strong>局</span>
        <span class="cum-item">累计<span class="${cumPnL >= 0 ? 'up' : 'down'}">${cumPnL >= 0 ? '+' : ''}$${cumPnL.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</span></span>
        <span class="cum-item"><span class="${cumReturn >= 0 ? 'up' : 'down'}">${cumReturn >= 0 ? '+' : ''}${cumReturn.toFixed(1)}%</span></span>
    `;
}

function updatePositionBar() {
    const el = document.getElementById('positionBar');
    if (state.shares === 0) {
        state.stopLossPrice = null;
        el.innerHTML = '<span class="no-position">暂无持仓 · 可无限次买卖</span>';
        updateStopLossLine();
        updateStopLossPanel();
        return;
    }
    const price = getCurrentPrice();
    const isLong = state.shares > 0;
    const absShares = Math.abs(state.shares);
    const pnl = state.shares * (price - state.avgCost);
    const sideText = isLong ? '做多' : '做空';
    const sideClass = isLong ? 'long' : 'short';
    const pnlColor = pnl >= 0 ? 'var(--color-up)' : 'var(--color-down)';
    el.innerHTML = `
        <span class="pos-tag ${sideClass}">${sideText}</span>
        <span style="color:var(--text-secondary)">${absShares}股 @$${state.avgCost.toFixed(2)}→$${price.toFixed(2)}</span>
        <span style="color:${pnlColor};font-weight:600;font-family:var(--font-mono)">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(0)}</span>
    `;
    updateStopLossLine();
    updateStopLossPanel();
}

function updateStopLossLine() {
    if (!candleSeries) return;
    if (stopLossPriceLine) {
        candleSeries.removePriceLine(stopLossPriceLine);
        stopLossPriceLine = null;
    }
    const label = document.getElementById('slLineLabel');
    if (state.stopLossPrice !== null && state.shares !== 0 && !state.gameOver) {
        stopLossPriceLine = candleSeries.createPriceLine({
            price: state.stopLossPrice,
            color: '#f59e0b',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: false,
            title: '',
        });
        // 左侧标签定位
        if (label) {
            const y = candleSeries.priceToCoordinate(state.stopLossPrice);
            if (y !== null && y !== undefined) {
                const price = getCurrentPrice();
                const slDist = ((state.stopLossPrice - price) / price * 100);
                const distColor = slDist >= 0 ? 'var(--color-up)' : 'var(--color-down)';
                label.innerHTML = `止损 $${state.stopLossPrice.toFixed(2)} <span style="color:${distColor}">${slDist >= 0 ? '+' : ''}${slDist.toFixed(1)}%</span>`;
                label.style.display = 'block';
                label.style.top = `${y}px`;
            } else {
                label.style.display = 'none';
            }
        }
    } else {
        if (label) label.style.display = 'none';
    }
}

function updateStopLossPanel() {
    const panel = document.getElementById('slFloatingPanel');
    const body = document.getElementById('slPanelBody');
    if (!panel || !body) return;
    if (state.shares === 0 || state.gameOver) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    const price = getCurrentPrice();
    if (state.stopLossPrice !== null) {
        const slDist = ((state.stopLossPrice - price) / price * 100);
        const distColor = slDist >= 0 ? 'var(--color-up)' : 'var(--color-down)';
        body.innerHTML = `
            <div class="sl-panel-price">$${state.stopLossPrice.toFixed(2)}</div>
            <div class="sl-panel-dist" style="color:${distColor}">${slDist >= 0 ? '+' : ''}${slDist.toFixed(1)}%</div>
            <button class="sl-panel-btn" onclick="openStopLossPanel()">修改</button>
            <button class="sl-panel-cancel" onclick="cancelStopLoss()">取消止损</button>
        `;
    } else {
        body.innerHTML = `
            <div class="sl-panel-notset">未设置</div>
            <button class="sl-panel-btn" onclick="openStopLossPanel()">+ 设置止损</button>
        `;
    }
}

// ===== 止损面板拖拽 =====
let slDragState = null;
let slRafId = null;

function initSlPanelDrag() {
    const panel = document.getElementById('slFloatingPanel');
    const header = document.getElementById('slPanelHeader');
    if (!panel || !header) return;

    let pendingLeft, pendingTop;

    function applyPosition() {
        slRafId = null;
        if (!slDragState) return;
        panel.style.left = pendingLeft + 'px';
        panel.style.top = pendingTop + 'px';
    }

    header.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();

        panel.style.transform = 'none';
        panel.style.willChange = 'left, top';
        
        const rect = panel.getBoundingClientRect();
        const parentRect = panel.parentElement.getBoundingClientRect();
        
        slDragState = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left - parentRect.left,
            startTop: rect.top - parentRect.top,
            panelWidth: rect.width,
            panelHeight: rect.height,
            parentWidth: parentRect.width,
            parentHeight: parentRect.height,
        };
        
        panel.classList.add('dragging');
        panel.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', (e) => {
        if (!slDragState) return;
        
        const dx = e.clientX - slDragState.startX;
        const dy = e.clientY - slDragState.startY;
        
        pendingLeft = Math.max(0, Math.min(slDragState.startLeft + dx, slDragState.parentWidth - slDragState.panelWidth));
        pendingTop = Math.max(0, Math.min(slDragState.startTop + dy, slDragState.parentHeight - slDragState.panelHeight));
        
        if (!slRafId) {
            slRafId = requestAnimationFrame(applyPosition);
        }
    });

    const endDrag = () => {
        if (slDragState) {
            panel.classList.remove('dragging');
            panel.style.willChange = 'auto';
            slDragState = null;
            if (slRafId) {
                cancelAnimationFrame(slRafId);
                slRafId = null;
            }
        }
    };

    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);
    header.addEventListener('lostpointercapture', endDrag);
}

function updateTradeHistory() {
    const el = document.getElementById('tradeHistory');
    const visible = state.trades.filter(t => t.day <= state.currentDay);
    if (visible.length === 0) { el.innerHTML = '<p class="empty-history">暂无交易记录</p>'; return; }
    const sorted = [...visible].reverse();
    el.innerHTML = sorted.map(t => {
        const action = t.type === 'buy' ? '买入' : '卖出';
        const actionClass = t.type === 'buy' ? 'long' : 'short';
        const closeTag = t.close ? (t.stopLoss ? ' <span style="color:var(--color-warning)">止损</span>' : ' <span style="color:var(--color-warning)">平仓</span>') : '';
        return `<div class="trade-item"><span class="trade-day">D${t.day+1}</span><span class="trade-action ${actionClass}">${action}</span><span class="trade-detail">${t.shares}股 @$${t.price.toFixed(2)}${closeTag}</span></div>`;
    }).join('');
}

// ===== 游戏结束 =====
function endGame(reason) {
    state.gameOver = true;
    state.revealed = true;

    // 用最后一个真实交易日的价格平仓（避免 currentDay 越界导致价格=0）
    const lastIdx = Math.min(state.currentDay, state.tradingKlines.length - 1);
    if (state.shares !== 0) {
        const price = state.tradingKlines[lastIdx] ? state.tradingKlines[lastIdx].close : getCurrentPrice();
        if (state.shares > 0) {
            state.cash += state.shares * price;
            state.trades.push({ day: state.currentDay, type: 'sell', shares: state.shares, price, close: true, auto: true });
        } else {
            state.cash -= Math.abs(state.shares) * price;
            state.trades.push({ day: state.currentDay, type: 'buy', shares: Math.abs(state.shares), price, close: true, auto: true });
        }
        state.shares = 0;
        state.avgCost = 0;
        state.stopLossPrice = null;
    }

    const finalCash = state.cash;
    const gamePnL = finalCash - state.initialCash;
    const gameReturn = state.initialCash > 0 ? (gamePnL / state.initialCash) * 100 : 0;

    cumulative.cash = finalCash > 0 ? finalCash : 0;
    cumulative.gamesPlayed++;
    cumulative.totalPnL += gamePnL;
    if (gameReturn > cumulative.bestReturn) cumulative.bestReturn = gameReturn;
    if (gameReturn < cumulative.worstReturn) cumulative.worstReturn = gameReturn;
    saveCumulative();
    updateCumulativeUI();

    updateStockHeader();
    updateChart();
    // 不调用 fitContent，让弹窗背后的K线图保持用户当前视图
    updateUI();

    const isWin = gamePnL > 0;
    const buyTrades = state.trades.filter(t => t.type === 'buy').length;
    const sellTrades = state.trades.filter(t => t.type === 'sell').length;
    const totalTrades = buyTrades + sellTrades;
    const tradingDays = calculateTradingDays();

    document.getElementById('modalTitle').textContent = isWin ? '🎉 交易盈利！' : '😢 交易亏损';
    document.getElementById('modalTitle').style.color = isWin ? 'var(--color-up)' : 'var(--color-down)';

    document.getElementById('resultSummary').innerHTML = `
        <div style="color:${isWin ? 'var(--color-up)' : 'var(--color-down)'}">
            ${gamePnL >= 0 ? '+' : ''}$${gamePnL.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
        </div>
        <div class="return-rate" style="color:${isWin ? 'var(--color-up)' : 'var(--color-down)'}">
            本局收益率 ${gameReturn >= 0 ? '+' : ''}${gameReturn.toFixed(2)}%
        </div>
    `;

    const firstDate = state.historyKlines[0].date;
    const lastDate = state.tradingKlines[state.tradingKlines.length - 1].date;
    const cumPnL = cumulative.cash - cumulative.originalCash;
    const cumReturn = cumulative.originalCash > 0 ? (cumPnL / cumulative.originalCash * 100) : 0;
    const bestReturn = cumulative.bestReturn === -Infinity ? 'N/A' : `${cumulative.bestReturn >= 0 ? '+' : ''}${cumulative.bestReturn.toFixed(1)}%`;
    const worstReturn = cumulative.worstReturn === Infinity ? 'N/A' : `${cumulative.worstReturn >= 0 ? '+' : ''}${cumulative.worstReturn.toFixed(1)}%`;

    document.getElementById('resultDetails').innerHTML = `
        <div class="result-detail-item"><div class="label">最终资产</div><div class="val">$${finalCash.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        <div class="result-detail-item"><div class="label">初始资金</div><div class="val">$${state.initialCash.toLocaleString('en-US',{minimumFractionDigits:0})}</div></div>
        <div class="result-detail-item"><div class="label">交易次数</div><div class="val">${totalTrades}次(买${buyTrades}/卖${sellTrades})</div></div>
        <div class="result-detail-item"><div class="label">交易天数</div><div class="val">${tradingDays > 0 ? tradingDays + '天' : '未交易'}</div></div>
        <div class="result-detail-item"><div class="label">累计资产</div><div class="val" style="color:${cumPnL >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">$${cumulative.cash.toLocaleString('en-US',{minimumFractionDigits:0})}</div></div>
        <div class="result-detail-item"><div class="label">累计盈亏</div><div class="val" style="color:${cumPnL >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${cumPnL >= 0 ? '+' : ''}$${cumPnL.toLocaleString('en-US',{minimumFractionDigits:0})} (${cumReturn >= 0 ? '+' : ''}${cumReturn.toFixed(1)}%)</div></div>
        <div class="result-detail-item"><div class="label">已玩局数</div><div class="val">${cumulative.gamesPlayed}局</div></div>
        <div class="result-detail-item"><div class="label">最佳/最差</div><div class="val" style="font-size:13px">${bestReturn} / ${worstReturn}</div></div>
    `;

    const dsLabel = '富途牛牛 · 近3年数据';
    document.getElementById('resultStock').innerHTML = `交易股票: <strong>${state.stockName} (${state.stockCode})</strong><br>时间: ${firstDate} ~ ${lastDate} · ${dsLabel}`;

    const btnArea = document.getElementById('resultButtons');
    if (cumulative.cash <= 0) {
        btnArea.innerHTML = `<button class="btn-restart" onclick="newGame()">资金归零，重新开始（$100,000）</button>`;
    } else {
        btnArea.innerHTML = `
            <button class="btn-restart" onclick="newGame()">再来一局（带入 $${cumulative.cash.toLocaleString('en-US',{minimumFractionDigits:0})}）</button>
        `;
    }

    document.getElementById('gameOverModal').classList.add('show');
    showToast(`游戏结束！${isWin ? '盈利' : '亏损'} $${Math.abs(gamePnL).toFixed(0)}`, isWin ? 'success' : 'error');
}

// ===== 辅助 =====
function updateTradeEstimate() {
    const el = document.getElementById('tradeEstimate');
    if (!el) return;
    if (state.gameOver) { el.textContent = ''; return; }
    const price = getCurrentPrice();
    if (price <= 0) { el.textContent = ''; return; }

    const buyAmount = state.cash;
    const buyShares = Math.floor(buyAmount / price);
    const equity = calculateEquity();
    const shortAmount = equity;
    const shortShares = Math.floor(shortAmount / price);

    el.textContent = `全仓 · 做多 ≈${buyShares}股 · 做空 ≈${shortShares}股`;
}

function toggleHistory() {
    const drawer = document.getElementById('historyDrawer');
    const overlay = document.getElementById('historyOverlay');
    drawer.classList.toggle('show');
    overlay.classList.toggle('show');
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showLoading(show) {
    document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

// ===== 划线画图系统（富途牛牛风格）=====

function toggleDrawMode() {
    drawingMode = !drawingMode;
    const overlay = document.getElementById('drawOverlay');
    const toolbar = document.getElementById('drawToolbar');
    const toggleBtn = document.getElementById('drawToggle');

    if (drawingMode) {
        overlay.style.pointerEvents = 'auto';
        toolbar.style.display = 'block';
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = '&#10005;';
        if (chart) chart.applyOptions({ handleScroll: false, handleScale: false });
        buildDrawToolbar();
        selectDrawTool('select');
        renderDrawings();
    } else {
        overlay.style.pointerEvents = 'none';
        toolbar.style.display = 'none';
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '&#9998;';
        if (chart) chart.applyOptions({ handleScroll: true, handleScale: true });
        pendingDrawing = null;
        drawGesture = null;
        pendingChannel = false;
        selectDrawing(null);
        closeDrawSettings();
        renderDrawings();
    }
}

// ---------- 工具栏 ----------
function buildDrawToolbar() {
    const wrap = document.getElementById('dtTools');
    if (!wrap) return;
    let html = '';
    for (const t of DRAW_TOOLS) {
        html += `<button class="dt-btn" data-tool="${t.id}" onclick="selectDrawTool('${t.id}')">
            <span class="dt-ic">${t.icon}</span><span class="dt-lb">${t.name}</span></button>`;
    }
    html += '<span class="dt-sep"></span>';
    for (const a of DT_ACTIONS) {
        html += `<button class="dt-btn dt-act" id="${a.id === 'magnet' ? 'magnetToggle' : ''}" onclick="${a.act}">
            <span class="dt-ic">${a.icon}</span><span class="dt-lb">${a.name}</span></button>`;
    }
    wrap.innerHTML = html;
    refreshToolbarActive();
}

function refreshToolbarActive() {
    document.querySelectorAll('#dtTools .dt-btn[data-tool]').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === activeTool);
    });
    const m = document.getElementById('magnetToggle');
    if (m) m.classList.toggle('active', magnetMode);
}

function selectDrawTool(tool) {
    activeTool = tool;
    pendingDrawing = null;
    drawGesture = null;
    pendingChannel = false;
    if (tool !== 'select') selectDrawing(null);
    closeDrawSettings();
    refreshToolbarActive();
    updateDrawIndicator();
    renderDrawings();
}

function toggleMagnet() {
    magnetMode = !magnetMode;
    refreshToolbarActive();
    showToast(magnetMode ? '磁吸已开启（优先吸附开/收，其次高/低）' : '磁吸已关闭', 'info');
}

function updateDrawIndicator() {
    const el = document.getElementById('drawIndicator');
    if (!el) return;
    if (!drawingMode) { el.style.display = 'none'; return; }
    if (activeTool === 'select') {
        el.textContent = selectedId ? '已选中：拖动手柄调整端点，拖动线体整体移动' : '点击画线可选中编辑，点空白处取消';
        el.style.display = 'block';
        return;
    }
    let hint = '';
    if (pendingChannel) hint = '点击设置平行通道的偏移点（第3点）';
    else {
        const hints = {
            trendline: pendingDrawing ? '移动预览，点击/松手确定终点' : '按住拖动绘制趋势线（或点击两点）',
            straightline: pendingDrawing ? '移动预览，点击/松手确定终点' : '按住拖动绘制直线（两端无限延伸）',
            horizontalline: '点击图表放置水平线',
            verticalline: '点击图表放置垂直线',
            ray: pendingDrawing ? '移动预览，点击/松手确定方向' : '按住拖动绘制射线',
            rectangle: pendingDrawing ? '移动预览，点击/松手确定对角点' : '按住拖动绘制矩形',
            channel: pendingDrawing ? '移动预览，点击/松手确定基准线，再点第3点定偏移' : '按住拖动绘制通道基准线',
            arrow: pendingDrawing ? '移动预览，点击/松手确定终点' : '按住拖动绘制箭头',
            fibonacci: pendingDrawing ? '移动预览，点击/松手确定终点' : '按住拖动绘制黄金分割',
            brush: '按住拖动自由绘制',
            text: '点击图表放置文字',
        };
        hint = hints[activeTool] || '';
    }
    el.textContent = hint;
    el.style.display = 'block';
}

// ---------- 持久化（按股票保存） ----------
function drawingsKey() { return 'stDrawings_' + (state.stockCode || ''); }

function saveDrawingsForStock() {
    if (!state.stockCode) return;
    try { localStorage.setItem(drawingsKey(), JSON.stringify(drawings)); } catch (e) {}
}

function loadDrawingsForStock() {
    selectedId = null;
    pendingDrawing = null;
    drawGesture = null;
    pendingChannel = false;
    drawings = [];
    if (!state.stockCode) return;
    try {
        const raw = localStorage.getItem(drawingsKey());
        if (raw) {
            drawings = JSON.parse(raw) || [];
            nextDrawId = drawings.reduce((m, d) => Math.max(m, d.id || 0), 0) + 1;
        }
    } catch (e) { drawings = []; }
    updateDrawSelBar();
}

// ---------- 坐标与磁吸 ----------
function getDrawPos(evt) {
    const container = document.getElementById('chartContainer');
    const rect = container.getBoundingClientRect();
    const t = evt.touches ? (evt.touches[0] || evt.changedTouches[0]) : evt;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

function timeToStr(time) {
    if (typeof time === 'string') return time;
    if (time && time.year) return `${time.year}-${String(time.month).padStart(2,'0')}-${String(time.day).padStart(2,'0')}`;
    return null;
}

function screenToData(x, y) {
    if (!chart || !candleSeries) return null;
    const ts = chart.timeScale();
    const price = candleSeries.coordinateToPrice(y);
    if (price === null || price === undefined) return null;

    // 先尝试用时间坐标（K线数据范围内）
    const time = ts.coordinateToTime(x);
    const timeStr = timeToStr(time);
    if (timeStr) return { time: timeStr, price };

    // 空白区域（右侧offset等）：用逻辑坐标兜底
    const logical = ts.coordinateToLogical(x);
    if (logical !== null && logical !== undefined) {
        return { time: '__log_' + logical.toFixed(4), price };
    }
    return null;
}

function dataToScreen(time, price) {
    if (!chart || !candleSeries) return null;
    const ts = chart.timeScale();
    let x;
    if (typeof time === 'string' && time.startsWith('__log_')) {
        // 逻辑坐标（空白区域画线）
        const logical = parseFloat(time.substring(6));
        x = ts.logicalToCoordinate(logical);
    } else {
        x = ts.timeToCoordinate(time);
    }
    const y = candleSeries.priceToCoordinate(price);
    if (x === null || x === undefined || y === null || y === undefined) return null;
    return { x, y };
}

// K线索引缓存（date -> {k, i}）
let _kMapCache = null, _kMapKey = '';
function getKlineMap() {
    const all = getAllKlines();
    const key = (state.stockCode || '') + ':' + all.length + ':' + (all.length ? all[all.length - 1].date : '');
    if (_kMapCache && _kMapKey === key) return _kMapCache;
    const m = {};
    all.forEach((k, i) => { m[k.date] = { k, i }; });
    _kMapCache = m; _kMapKey = key;
    return m;
}

// 磁吸：优先吸附开/收，其次高/低（仅在极近时吸附）
function snapPoint(x, y) {
    if (!magnetMode || !chart || !candleSeries) return null;
    const time = chart.timeScale().coordinateToTime(x);
    const timeStr = timeToStr(time);
    if (!timeStr) return null;
    const entry = getKlineMap()[timeStr];
    if (!entry) return null;
    const k = entry.k;
    const snapDist = 8; // 磁吸吸附距离（像素），仅在极近时吸附
    // 第一优先级：开/收
    let best = null, bestD = snapDist;
    for (const v of [k.open, k.close]) {
        const cy = candleSeries.priceToCoordinate(v);
        if (cy === null || cy === undefined) continue;
        const d = Math.abs(cy - y);
        if (d < bestD) { bestD = d; best = v; }
    }
    // 第二优先级：高/低（仅在开/收未命中时）
    if (best === null) {
        for (const v of [k.high, k.low]) {
            const cy = candleSeries.priceToCoordinate(v);
            if (cy === null || cy === undefined) continue;
            const d = Math.abs(cy - y);
            if (d < bestD) { bestD = d; best = v; }
        }
    }
    return best === null ? null : { time: timeStr, price: best };
}

function snapOrData(pos) {
    return snapPoint(pos.x, pos.y) || screenToData(pos.x, pos.y);
}

// ---------- 画线数据 ----------
function getDrawing(id) { return drawings.find(d => d.id === id) || null; }

function defaultToolColor(t) {
    if (t === 'horizontalline') return '#F23645';
    if (t === 'fibonacci') return '#FFD60A';
    if (t === 'rectangle' || t === 'channel') return '#AB47BC';
    return '#2F6BFF';
}

function makeDrawing(type, points, extra) {
    return Object.assign({
        id: nextDrawId++,
        type,
        points,
        style: { color: defaultToolColor(type), width: 1.5, dash: 'solid' },
    }, extra || {});
}

function commitDrawing(d) {
    drawings.push(d);
    pendingDrawing = null;
    drawGesture = null;
    pendingChannel = false;
    selectedId = d.id;
    saveDrawingsForStock();
    updateDrawSelBar();
    updateDrawIndicator();
    renderDrawings();
}

function selectDrawing(id) {
    selectedId = id;
    updateDrawSelBar();
    updateDrawIndicator();
    renderDrawings();
}

function updateDrawSelBar() {
    const bar = document.getElementById('drawSelBar');
    if (!bar) return;
    bar.style.display = (selectedId && drawingMode) ? 'flex' : 'none';
}

function deleteSelectedDrawing() {
    if (selectedId === null) { showToast('请先选中一条画线', 'info'); return; }
    drawings = drawings.filter(d => d.id !== selectedId);
    selectedId = null;
    pendingDrawing = null;
    pendingChannel = false;
    saveDrawingsForStock();
    updateDrawSelBar();
    updateDrawIndicator();
    renderDrawings();
    showToast('已删除画线', 'info');
}

function undoDrawing() {
    if (pendingDrawing) { pendingDrawing = null; pendingChannel = false; drawGesture = null; renderDrawings(); updateDrawIndicator(); return; }
    if (drawings.length === 0) { showToast('没有可撤销的画线', 'info'); return; }
    const removed = drawings.pop();
    if (selectedId === removed.id) { selectedId = null; updateDrawSelBar(); }
    saveDrawingsForStock();
    renderDrawings();
    updateDrawIndicator();
}

function clearDrawings() {
    if (drawings.length === 0 && !pendingDrawing) { showToast('没有画线可清除', 'info'); return; }
    drawings = [];
    pendingDrawing = null;
    pendingChannel = false;
    drawGesture = null;
    selectedId = null;
    saveDrawingsForStock();
    updateDrawSelBar();
    renderDrawings();
    updateDrawIndicator();
    showToast('已清空全部画线', 'info');
}

// ---------- 设置面板 ----------
function openDrawSettings() {
    const d = getDrawing(selectedId);
    if (!d) return;
    const colorsEl = document.getElementById('dsColors');
    const widthsEl = document.getElementById('dsWidths');
    const stylesEl = document.getElementById('dsStyles');
    if (!colorsEl) return;

    colorsEl.innerHTML = FUTU_COLORS.map(c =>
        `<button class="ds-color ${d.style.color.toUpperCase() === c.toUpperCase() ? 'active' : ''}" style="background:${c}" onclick="setDrawStyle('color','${c}')"></button>`).join('');

    widthsEl.innerHTML = [1, 1.5, 2.5].map(w =>
        `<button class="ds-opt ${d.style.width === w ? 'active' : ''}" onclick="setDrawStyle('width',${w})">
            <span class="ds-line" style="height:${w + 0.5}px;background:var(--text-primary)"></span></button>`).join('');

    const styleNames = { solid: '实线', dashed: '虚线', dotted: '点线' };
    stylesEl.innerHTML = Object.keys(DASH_MAP).map(s =>
        `<button class="ds-opt ${d.style.dash === s ? 'active' : ''}" onclick="setDrawStyle('dash','${s}')">${styleNames[s]}</button>`).join('');

    document.getElementById('drawSettingsOverlay').style.display = 'flex';
}

function closeDrawSettings() {
    const o = document.getElementById('drawSettingsOverlay');
    if (o) o.style.display = 'none';
}

function setDrawStyle(key, value) {
    const d = getDrawing(selectedId);
    if (!d) return;
    d.style[key] = value;
    saveDrawingsForStock();
    renderDrawings();
    openDrawSettings(); // 刷新选中态
}

// ---------- 事件绑定（Pointer Events） ----------
function initDrawOverlay() {
    const overlay = document.getElementById('drawOverlay');
    if (!overlay) return;
    overlay.addEventListener('pointerdown', onDrawPointerDown);
    overlay.addEventListener('pointermove', onDrawPointerMove);
    overlay.addEventListener('pointerup', onDrawPointerUp);
    overlay.addEventListener('pointercancel', onDrawPointerUp);
}

function onDrawPointerDown(e) {
    if (!drawingMode) return;
    const pos = getDrawPos(e);

    // ===== 选择模式：选中 / 编辑 =====
    if (activeTool === 'select') {
        e.preventDefault();
        try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) {}
        const sel = getDrawing(selectedId);
        if (sel) {
            const hi = hitHandle(sel, pos);
            if (hi >= 0) {
                drawGesture = { mode: 'handle', d: sel, hi };
                return;
            }
        }
        const hit = hitDrawing(pos);
        if (hit) {
            if (hit.id !== selectedId) selectDrawing(hit.id);
            const startData = screenToData(pos.x, pos.y);
            if (startData) {
                drawGesture = {
                    mode: 'move', d: hit,
                    startData,
                    orig: hit.points.map(p => ({ time: p.time, price: p.price })),
                };
            }
        } else {
            selectDrawing(null);
        }
        return;
    }

    // ===== 绘制工具 =====
    e.preventDefault();
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) {}

    // 平行通道：等待第3点
    if (pendingChannel && pendingDrawing && pendingDrawing.type === 'channel') {
        const data = snapOrData(pos);
        if (!data) return;
        pendingDrawing.points.push(data);
        commitDrawing(pendingDrawing);
        return;
    }

    // 点击式第二点（上次点击未拖动）
    if (pendingDrawing && pendingDrawing.points.length >= 2 && !drawGesture) {
        const data = snapOrData(pos);
        if (!data) return;
        pendingDrawing.points[1] = data;
        if (pendingDrawing.type === 'channel') {
            pendingChannel = true;
            drawGesture = null;
            updateDrawIndicator();
            renderDrawings();
            return;
        }
        commitDrawing(pendingDrawing);
        return;
    }

    const data = snapOrData(pos);
    if (!data) return;

    if (activeTool === 'horizontalline' || activeTool === 'verticalline') {
        commitDrawing(makeDrawing(activeTool, [data]));
        return;
    }

    if (activeTool === 'text') {
        const txt = prompt('请输入文字内容：', '');
        if (txt && txt.trim()) commitDrawing(makeDrawing('text', [data], { text: txt.trim() }));
        return;
    }

    if (activeTool === 'brush') {
        pendingDrawing = makeDrawing('brush', [data]);
        drawGesture = { mode: 'brush', last: pos };
        renderDrawings();
        updateDrawIndicator();
        return;
    }

    // 两点/三点工具：按下即第一点，拖动实时预览
    pendingDrawing = makeDrawing(activeTool, [data, data]);
    drawGesture = { mode: 'draw', sx: pos.x, sy: pos.y, moved: false };
    renderDrawings();
    updateDrawIndicator();
}

function onDrawPointerMove(e) {
    if (!drawingMode) return;
    const pos = getDrawPos(e);

    if (drawGesture && drawGesture.mode === 'brush' && pendingDrawing) {
        e.preventDefault();
        const last = drawGesture.last;
        if (Math.hypot(pos.x - last.x, pos.y - last.y) < 4) return;
        const data = snapOrData(pos);
        if (data) {
            pendingDrawing.points.push(data);
            drawGesture.last = pos;
            renderDrawings();
        }
        return;
    }

    if (drawGesture && drawGesture.mode === 'draw' && pendingDrawing) {
        e.preventDefault();
        if (Math.hypot(pos.x - drawGesture.sx, pos.y - drawGesture.sy) > 5) drawGesture.moved = true;
        const data = snapOrData(pos);
        if (data) {
            pendingDrawing.points[1] = data;
            renderDrawings();
        }
        return;
    }

    if (drawGesture && drawGesture.mode === 'handle') {
        e.preventDefault();
        const data = snapOrData(pos);
        if (data) {
            const d = drawGesture.d;
            if (d.type === 'horizontalline') d.points[0].price = data.price;
            else if (d.type === 'verticalline') d.points[0].time = data.time;
            else d.points[drawGesture.hi] = data;
            renderDrawings();
        }
        return;
    }

    if (drawGesture && drawGesture.mode === 'move') {
        e.preventDefault();
        const cur = screenToData(pos.x, pos.y);
        if (cur) {
            translateDrawing(drawGesture.d, drawGesture.orig, drawGesture.startData, cur);
            renderDrawings();
        }
        return;
    }

    // 无手势时的悬停预览（点击式第二点）
    if (pendingDrawing && pendingDrawing.points.length >= 2 && !pendingChannel) {
        const data = snapOrData(pos);
        if (data) {
            pendingDrawing.points[1] = data;
            renderDrawings();
        }
    }
}

function onDrawPointerUp(e) {
    if (!drawingMode || !drawGesture) return;

    if (drawGesture.mode === 'brush') {
        if (pendingDrawing && pendingDrawing.points.length > 2) commitDrawing(pendingDrawing);
        else { pendingDrawing = null; renderDrawings(); updateDrawIndicator(); }
        drawGesture = null;
        return;
    }

    if (drawGesture.mode === 'draw' && pendingDrawing) {
        if (!drawGesture.moved) {
            // 未拖动 → 保持点击式：等待第二点
            drawGesture = null;
            updateDrawIndicator();
            return;
        }
        if (pendingDrawing.type === 'channel') {
            pendingChannel = true;
            drawGesture = null;
            updateDrawIndicator();
            renderDrawings();
            return;
        }
        commitDrawing(pendingDrawing);
        return;
    }

    if (drawGesture.mode === 'handle' || drawGesture.mode === 'move') {
        saveDrawingsForStock();
        renderDrawings();
    }
    drawGesture = null;
}

// 整体移动：按K线根数平移时间 + 价差平移价格
function translateDrawing(d, orig, startData, curData) {
    const map = getKlineMap();
    const all = getAllKlines();
    const isLog = t => typeof t === 'string' && t.startsWith('__log_');
    const parseLog = t => parseFloat(t.substring(6));

    // 计算时间偏移（K线根数或逻辑坐标增量）
    let dBars = 0;
    if (isLog(startData.time) && isLog(curData.time)) {
        dBars = Math.round(parseLog(curData.time) - parseLog(startData.time));
    } else {
        const s = map[startData.time];
        const c = map[curData.time];
        dBars = (s && c) ? (c.i - s.i) : 0;
    }
    const dPrice = curData.price - startData.price;

    if (d.type === 'horizontalline') {
        d.points[0].price = orig[0].price + dPrice;
        return;
    }
    if (d.type === 'verticalline') {
        if (isLog(orig[0].time)) {
            d.points[0].time = '__log_' + (parseLog(orig[0].time) + dBars).toFixed(4);
        } else {
            const o = map[orig[0].time];
            if (o) {
                const ni = Math.max(0, Math.min(all.length - 1, o.i + dBars));
                d.points[0].time = all[ni].date;
            }
        }
        return;
    }
    d.points = orig.map(p => {
        if (isLog(p.time)) {
            return { time: '__log_' + (parseLog(p.time) + dBars).toFixed(4), price: p.price + dPrice };
        }
        const o = map[p.time];
        let newTime = p.time;
        if (o) {
            const ni = Math.max(0, Math.min(all.length - 1, o.i + dBars));
            newTime = all[ni].date;
        }
        return { time: newTime, price: p.price + dPrice };
    });
}

// ---------- 命中检测 ----------
function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitHandle(d, pos) {
    for (let i = 0; i < d.points.length; i++) {
        const p = dataToScreen(d.points[i].time, d.points[i].price);
        if (p && Math.hypot(pos.x - p.x, pos.y - p.y) < 16) return i;
    }
    return -1;
}

function hitDrawing(pos) {
    const th = 9;
    for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        const pts = d.points.map(p => dataToScreen(p.time, p.price));
        if (pts.some(p => !p)) continue;

        if (d.type === 'horizontalline') { if (Math.abs(pos.y - pts[0].y) < th) return d; continue; }
        if (d.type === 'verticalline')   { if (Math.abs(pos.x - pts[0].x) < th) return d; continue; }
        if (d.type === 'text')           { if (Math.hypot(pos.x - pts[0].x, pos.y - pts[0].y) < 26) return d; continue; }
        if (d.type === 'brush') {
            for (let j = 1; j < pts.length; j++) {
                if (distToSeg(pos.x, pos.y, pts[j-1].x, pts[j-1].y, pts[j].x, pts[j].y) < th) return d;
            }
            continue;
        }
        if (pts.length < 2) continue;
        const p1 = pts[0], p2 = pts[1];

        if (d.type === 'rectangle') {
            const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
            const w = Math.abs(p2.x - p1.x), h = Math.abs(p2.y - p1.y);
            const inside = pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h;
            const nearEdge =
                distToSeg(pos.x, pos.y, x, y, x + w, y) < th ||
                distToSeg(pos.x, pos.y, x, y + h, x + w, y + h) < th ||
                distToSeg(pos.x, pos.y, x, y, x, y + h) < th ||
                distToSeg(pos.x, pos.y, x + w, y, x + w, y + h) < th;
            if (inside || nearEdge) return d;
            continue;
        }
        if (d.type === 'channel') {
            if (pts.length < 3) {
                if (distToSeg(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y) < th) return d;
                continue;
            }
            const q1 = pts[2];
            const q2 = { x: pts[2].x + (p2.x - p1.x), y: pts[2].y + (p2.y - p1.y) };
            if (distToSeg(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y) < th) return d;
            if (distToSeg(pos.x, pos.y, q1.x, q1.y, q2.x, q2.y) < th) return d;
            continue;
        }
        if (d.type === 'straightline') {
            const ex = (p2.x - p1.x) || 0.001, ey = (p2.y - p1.y) || 0.001;
            const f1 = { x: p1.x - ex * 50, y: p1.y - ey * 50 };
            const f2 = { x: p2.x + ex * 50, y: p2.y + ey * 50 };
            if (distToSeg(pos.x, pos.y, f1.x, f1.y, f2.x, f2.y) < th) return d;
            continue;
        }
        if (d.type === 'ray') {
            const ex = p2.x - p1.x, ey = p2.y - p1.y;
            const f2 = { x: p2.x + ex * 50, y: p2.y + ey * 50 };
            if (distToSeg(pos.x, pos.y, p1.x, p1.y, f2.x, f2.y) < th) return d;
            continue;
        }
        if (d.type === 'fibonacci') {
            if (distToSeg(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y) < th) return d;
            const leftX = Math.min(p1.x, p2.x);
            for (const fib of FIB_LEVELS) {
                const price = d.points[0].price + fib.level * (d.points[1].price - d.points[0].price);
                const sy = candleSeries.priceToCoordinate(price);
                if (sy === null || sy === undefined) continue;
                if (pos.x >= leftX - 4 && Math.abs(pos.y - sy) < 7) return d;
            }
            continue;
        }
        // trendline / arrow
        if (distToSeg(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y) < th) return d;
    }
    return null;
}

// ---------- 渲染 ----------
function createSvgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

function strokeAttrs(d, op) {
    const attrs = {
        stroke: d.style.color,
        'stroke-width': d.style.width,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        opacity: op,
    };
    const dash = DASH_MAP[d.style.dash];
    if (dash) attrs['stroke-dasharray'] = dash;
    return attrs;
}

function renderDrawings() {
    const svg = document.getElementById('drawOverlay');
    if (!svg) return;
    const container = document.getElementById('chartContainer');
    const w = container.clientWidth;
    const h = container.clientHeight;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.innerHTML = '';

    // 价格区域下边界：右价格轴 bottom margin=0.25 → 价格区到75%
    // 成交量 top margin=0.8 → 成交量区从80%开始，取78%作为裁剪线
    const priceBottom = h * 0.78;

    // clipPath：限制画线只渲染在价格区域，不与成交量重叠
    const defs = createSvgEl('defs', {});
    const clip = createSvgEl('clipPath', { id: 'drawClip' });
    clip.appendChild(createSvgEl('rect', { x: 0, y: 0, width: w, height: priceBottom }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    // 画线内容受clip限制
    const g = createSvgEl('g', { 'clip-path': 'url(#drawClip)' });
    svg.appendChild(g);

    for (const d of drawings) renderOneDrawing(g, d, w, h, false);
    if (pendingDrawing) renderOneDrawing(g, pendingDrawing, w, h, true);

    // 选中手柄不受clip限制（保证可交互）
    const sel = getDrawing(selectedId);
    if (sel && drawingMode) renderHandles(svg, sel);
}

function renderHandles(svg, d) {
    const color = d.style.color;
    // 包围选中区域的高亮虚线框
    for (const p of d.points) {
        const sp = dataToScreen(p.time, p.price);
        if (!sp) continue;
        svg.appendChild(createSvgEl('circle', { cx: sp.x, cy: sp.y, r: 7, fill: 'rgba(47,107,255,0.25)', stroke: '#fff', 'stroke-width': 1.5 }));
        svg.appendChild(createSvgEl('circle', { cx: sp.x, cy: sp.y, r: 2, fill: '#fff' }));
    }
}

function renderOneDrawing(svg, d, w, h, isPreview) {
    const color = d.style.color;
    const op = isPreview ? 0.8 : 1;
    const sA = strokeAttrs(d, op);

    const singlePointDot = (p) => {
        svg.appendChild(createSvgEl('circle', { cx: p.x, cy: p.y, r: 3.5, fill: color, opacity: op }));
    };

    if (d.type === 'horizontalline') {
        const p = dataToScreen(d.points[0].time, d.points[0].price);
        if (!p) return;
        svg.appendChild(createSvgEl('line', Object.assign({ x1: 0, y1: p.y, x2: w, y2: p.y }, sA)));
        // 右侧价格标签（富途样式）
        const label = d.points[0].price.toFixed(2);
        const lw = label.length * 6.5 + 10;
        svg.appendChild(createSvgEl('rect', { x: w - lw - 2, y: p.y - 8, width: lw, height: 16, rx: 3, fill: color, opacity: op }));
        const t = createSvgEl('text', { x: w - 7, y: p.y + 4, fill: '#0b0e14', 'font-size': 10.5, 'font-weight': 700, 'text-anchor': 'end', 'font-family': 'monospace' });
        t.textContent = label;
        svg.appendChild(t);
        return;
    }

    if (d.type === 'verticalline') {
        const p = dataToScreen(d.points[0].time, d.points[0].price);
        if (!p) return;
        svg.appendChild(createSvgEl('line', Object.assign({ x1: p.x, y1: 0, x2: p.x, y2: h }, sA)));
        return;
    }

    if (d.type === 'text') {
        const p = dataToScreen(d.points[0].time, d.points[0].price);
        if (!p) return;
        const fs = 13;
        const tw = d.text.length * fs * 0.62 + 10;
        svg.appendChild(createSvgEl('rect', { x: p.x, y: p.y - fs - 4, width: tw, height: fs + 10, rx: 4, fill: 'rgba(11,14,20,0.75)', stroke: color, 'stroke-width': 1, opacity: op }));
        const t = createSvgEl('text', { x: p.x + 5, y: p.y + 1, fill: color, 'font-size': fs, 'font-weight': 600, opacity: op });
        t.textContent = d.text;
        svg.appendChild(t);
        return;
    }

    if (d.type === 'brush') {
        if (d.points.length < 2) { const p = dataToScreen(d.points[0].time, d.points[0].price); if (p) singlePointDot(p); return; }
        const pts = d.points.map(p => dataToScreen(p.time, p.price)).filter(p => p);
        if (pts.length < 2) return;
        svg.appendChild(createSvgEl('polyline', Object.assign({ points: pts.map(p => `${p.x},${p.y}`).join(' '), fill: 'none' }, sA)));
        return;
    }

    // 两点及以上工具
    if (d.points.length < 2) {
        const p = dataToScreen(d.points[0].time, d.points[0].price);
        if (p) singlePointDot(p);
        return;
    }
    const p1 = dataToScreen(d.points[0].time, d.points[0].price);
    const p2 = dataToScreen(d.points[1].time, d.points[1].price);
    if (!p1 || !p2) return;

    if (d.type === 'trendline') {
        svg.appendChild(createSvgEl('line', Object.assign({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, sA)));
    } else if (d.type === 'arrow') {
        svg.appendChild(createSvgEl('line', Object.assign({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, sA)));
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const al = 10 + d.style.width * 2, aa = Math.PI / 6;
        svg.appendChild(createSvgEl('polygon', {
            points: `${p2.x},${p2.y} ${p2.x - al * Math.cos(angle - aa)},${p2.y - al * Math.sin(angle - aa)} ${p2.x - al * Math.cos(angle + aa)},${p2.y - al * Math.sin(angle + aa)}`,
            fill: color, opacity: op,
        }));
    } else if (d.type === 'straightline') {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        let ex1, ey1, ex2, ey2;
        if (Math.abs(dx) < 0.01) { ex1 = p1.x; ey1 = 0; ex2 = p1.x; ey2 = h; }
        else {
            const s = dy / dx;
            ex1 = 0; ey1 = p1.y + s * (0 - p1.x);
            ex2 = w; ey2 = p1.y + s * (w - p1.x);
            if (ey1 < 0) { ey1 = 0; ex1 = p1.x + (0 - p1.y) / s; }
            else if (ey1 > h) { ey1 = h; ex1 = p1.x + (h - p1.y) / s; }
            if (ey2 < 0) { ey2 = 0; ex2 = p1.x + (0 - p1.y) / s; }
            else if (ey2 > h) { ey2 = h; ex2 = p1.x + (h - p1.y) / s; }
        }
        svg.appendChild(createSvgEl('line', Object.assign({ x1: ex1, y1: ey1, x2: ex2, y2: ey2 }, sA)));
    } else if (d.type === 'ray') {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        let ex, ey;
        if (Math.abs(dx) < 0.01) { ex = p2.x; ey = dy > 0 ? h : 0; }
        else {
            const s = dy / dx;
            ex = w; ey = p1.y + s * (w - p1.x);
            if (ey < 0) { ey = 0; ex = p1.x + (0 - p1.y) / s; }
            else if (ey > h) { ey = h; ex = p1.x + (h - p1.y) / s; }
        }
        svg.appendChild(createSvgEl('line', Object.assign({ x1: p1.x, y1: p1.y, x2: ex, y2: ey }, sA)));
    } else if (d.type === 'rectangle') {
        const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
        const rw = Math.abs(p2.x - p1.x), rh = Math.abs(p2.y - p1.y);
        svg.appendChild(createSvgEl('rect', Object.assign({
            x, y, width: rw, height: rh, rx: 1,
            fill: color + '18',
        }, sA, { stroke: color, fill: color + '18' })));
    } else if (d.type === 'channel') {
        svg.appendChild(createSvgEl('line', Object.assign({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, sA)));
        if (d.points.length >= 3) {
            const p3 = dataToScreen(d.points[2].time, d.points[2].price);
            if (p3) {
                const q2 = { x: p3.x + (p2.x - p1.x), y: p3.y + (p2.y - p1.y) };
                // 通道填充
                svg.appendChild(createSvgEl('polygon', {
                    points: `${p1.x},${p1.y} ${p2.x},${p2.y} ${q2.x},${q2.y} ${p3.x},${p3.y}`,
                    fill: color + '14', opacity: op,
                }));
                svg.appendChild(createSvgEl('line', Object.assign({ x1: p3.x, y1: p3.y, x2: q2.x, y2: q2.y }, sA)));
            }
        }
    } else if (d.type === 'fibonacci') {
        const price1 = d.points[0].price, price2 = d.points[1].price;
        // 基准虚线
        svg.appendChild(createSvgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: color, 'stroke-width': 1, opacity: op * 0.4, 'stroke-dasharray': '3,3' }));
        const leftX = Math.min(p1.x, p2.x);
        for (const fib of FIB_LEVELS) {
            const price = price1 + fib.level * (price2 - price1);
            const sy = candleSeries.priceToCoordinate(price);
            if (sy === null || sy === undefined) continue;
            svg.appendChild(createSvgEl('line', { x1: leftX, y1: sy, x2: w, y2: sy, stroke: color, 'stroke-width': 0.9, opacity: op * 0.75 }));
            const lbl = createSvgEl('text', { x: w - 4, y: sy - 3, fill: color, 'font-size': 9.5, 'text-anchor': 'end', 'font-family': 'monospace', opacity: op * 0.95 });
            lbl.textContent = `${fib.pct} ${price.toFixed(2)}`;
            svg.appendChild(lbl);
        }
    }
}
