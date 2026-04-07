const API_KEY = import.meta.env.VITE_FMP_API_KEY;
const BASE = "https://financialmodelingprep.com/api/v3";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

// localStorage 캐시 읽기/쓰기
function getCache(key) {
  try {
    const raw = localStorage.getItem(`fmp_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(`fmp_${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded 등 무시 */ }
}

// 개별 종목 배당 히스토리 조회
export async function fetchDividendHistory(symbol) {
  const cacheKey = `div_${symbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!API_KEY || API_KEY === "your_api_key_here") return null;

  try {
    const res = await fetch(`${BASE}/historical-price-full/stock_dividend/${symbol}?apikey=${API_KEY}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.historical || [];
    setCache(cacheKey, data);
    return data;
  } catch { return null; }
}

// 종목 프로필 조회 (가격, 이름 등)
export async function fetchProfile(symbol) {
  const cacheKey = `profile_${symbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!API_KEY || API_KEY === "your_api_key_here") return null;

  try {
    const res = await fetch(`${BASE}/profile/${symbol}?apikey=${API_KEY}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json[0] || null;
    if (data) setCache(cacheKey, data);
    return data;
  } catch { return null; }
}

// 배당 히스토리 → 연간 배당 일정으로 변환
export function parseDividendSchedule(history, year) {
  if (!history || history.length === 0) return { exDates: [], payDates: [], div: 0, freq: "q" };

  // 해당 연도 또는 직전 연도 데이터 기준
  const yearData = history.filter(h => {
    const y = new Date(h.date).getFullYear();
    return y === year || y === year - 1;
  });

  // 최근 4~12건으로 패턴 추출
  const recent = history.slice(0, 12);
  const latestDiv = recent[0]?.dividend || 0;

  // 빈도 추정 (연간 지급 횟수)
  const years = {};
  recent.forEach(h => {
    const y = new Date(h.date).getFullYear();
    years[y] = (years[y] || 0) + 1;
  });
  const counts = Object.values(years);
  const avgFreq = counts.length > 0 ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : 4;
  const freq = avgFreq >= 10 ? "m" : "q";

  // ex-date / payment-date 추출 (해당 연도 기준, 없으면 작년 패턴 차용)
  const exDates = [];
  const payDates = [];

  const targetData = yearData.length >= 2 ? yearData : history.slice(0, avgFreq);

  targetData.forEach(h => {
    if (h.date) {
      const d = new Date(h.date);
      exDates.push([d.getMonth() + 1, d.getDate()]);
    }
    if (h.paymentDate) {
      const d = new Date(h.paymentDate);
      payDates.push([d.getMonth() + 1, d.getDate()]);
    }
  });

  return { exDates, payDates, div: latestDiv, freq };
}

// 종목 검색
export async function searchSymbol(query) {
  if (!API_KEY || API_KEY === "your_api_key_here") return [];
  const cacheKey = `search_${query}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE}/search?query=${encodeURIComponent(query)}&limit=10&exchange=NASDAQ,NYSE,AMEX&apikey=${API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  } catch { return []; }
}

// API 키 유효성 확인
export function hasApiKey() {
  return API_KEY && API_KEY !== "your_api_key_here";
}
