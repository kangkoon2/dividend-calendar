import { useState, useEffect, useMemo, useCallback } from "react";
import { FALLBACK_DB } from "./data/fallback";
import { fetchDividendHistory, fetchProfile, parseDividendSchedule, searchSymbol, hasApiKey } from "./api/dividends";

const MO_FULL = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DA = ["일","월","화","수","목","금","토"];
const EXR = 1380;
const nv = "#1b2a4a";
const gn = "#2d8a4e";
const rd = "#c94040";
const bg0 = "#f4f5f8";

export default function App() {
  const [db, setDb] = useState(FALLBACK_DB);
  const [hold, setHold] = useState(() => { try { return JSON.parse(localStorage.getItem("dv7")) || {}; } catch { return {}; } });
  const [cur, setCur] = useState(new Date());
  const [selDay, setSelDay] = useState(null);
  const [tab, setTab] = useState("cal");
  const [ccy, setCcy] = useState("USD");
  const [mgr, setMgr] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { localStorage.setItem("dv7", JSON.stringify(hold)); }, [hold]);

  // API 데이터 로드 (키가 있을 때만)
  useEffect(() => {
    if (!hasApiKey()) return;
    setApiReady(true);

    const loadData = async () => {
      setLoading(true);
      const year = new Date().getFullYear();
      const symbols = Object.keys(FALLBACK_DB);
      const updated = { ...FALLBACK_DB };

      for (const sym of symbols) {
        try {
          const [history, profile] = await Promise.all([
            fetchDividendHistory(sym),
            fetchProfile(sym),
          ]);

          if (history && history.length > 0) {
            const schedule = parseDividendSchedule(history, year);
            updated[sym] = {
              ...updated[sym],
              name: profile?.companyName || updated[sym].name,
              price: profile?.price || updated[sym].price,
              div: schedule.div || updated[sym].div,
              freq: schedule.freq || updated[sym].freq,
              ex: schedule.exDates.length > 0 ? schedule.exDates : updated[sym].ex,
              pay: schedule.payDates.length > 0 ? schedule.payDates : updated[sym].pay,
            };
          }
        } catch { /* 개별 종목 실패 시 fallback 유지 */ }
      }

      setDb(updated);
      setLoading(false);
    };

    loadData();
  }, []);

  const Y = cur.getFullYear(), M = cur.getMonth();
  const cv = a => ccy === "USD" ? `$${a.toFixed(2)}` : `₩${Math.round(a * EXR).toLocaleString()}`;
  const isHeld = tk => tk in hold;
  const myAmt = tk => isHeld(tk) ? (hold[tk] || 0) * db[tk].div : 0;

  const getEvents = useCallback((y, m) => {
    const e = [];
    Object.entries(db).forEach(([tk, s]) => {
      s.ex.forEach(([mm, d]) => { if (mm === m + 1) e.push({ tk, name: s.name, day: Math.min(d, new Date(y, m + 1, 0).getDate()), type: "ex", div: s.div }); });
      s.pay.forEach(([mm, d]) => { if (mm === m + 1) e.push({ tk, name: s.name, day: Math.min(d, new Date(y, m + 1, 0).getDate()), type: "pay", div: s.div }); });
    });
    return e.sort((a, b) => a.day - b.day || (a.type === "ex" ? -1 : 1));
  }, [db]);

  const mEvts = useMemo(() => getEvents(Y, M), [Y, M, getEvents]);
  const eForDay = d => mEvts.filter(e => e.day === d);
  const myMonthPay = mEvts.filter(e => e.type === "pay" && isHeld(e.tk)).reduce((s, e) => s + myAmt(e.tk), 0);
  const myYearPay = useMemo(() => { let t = 0; for (let m = 0; m < 12; m++) getEvents(Y, m).filter(e => e.type === "pay" && isHeld(e.tk)).forEach(e => t += myAmt(e.tk)); return t; }, [Y, hold, getEvents]);

  const fd = new Date(Y, M, 1).getDay();
  const dim = new Date(Y, M + 1, 0).getDate();
  const grid = []; for (let i = 0; i < fd; i++) grid.push(null); for (let d = 1; d <= dim; d++) grid.push(d);
  const td = new Date();
  const isToday = d => td.getDate() === d && td.getMonth() === M && td.getFullYear() === Y;
  const nav = dir => { setCur(new Date(Y, M + dir, 1)); setSelDay(null); setExpanded(false); };
  const toggle = tk => setHold(h => { const n = { ...h }; if (tk in n) delete n[tk]; else n[tk] = 10; return n; });
  const setSh = (tk, v) => setHold(h => ({ ...h, [tk]: parseInt(v) || 0 }));

  const list = selDay ? eForDay(selDay) : mEvts;
  const show = expanded ? list : list.slice(0, 5);
  const filtered = search ? Object.entries(db).filter(([t, s]) => t.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())) : Object.entries(db);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", background: bg0, minHeight: "100vh", color: nv }}>

      {/* ── Header ── */}
      <div style={{ background: nv, padding: "28px 24px 0", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 500, marginBottom: 4 }}>US Dividend</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>배당 캘린더</div>
          </div>
          {loading && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "4px 10px", background: "rgba(255,255,255,0.08)", borderRadius: 6 }}>데이터 갱신중</div>}
        </div>

        <div style={{ display: "flex", gap: 0, marginTop: 22 }}>
          {[["cal", "캘린더"], ["my", "내 종목"]].map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setMgr(false); setSearch(""); setSelDay(null); setExpanded(false); }}
              style={{ padding: "12px 20px", fontSize: 14, fontWeight: tab === k ? 700 : 400,
                color: tab === k ? "#fff" : "rgba(255,255,255,0.4)",
                background: tab === k ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none", borderRadius: "10px 10px 0 0", cursor: "pointer", letterSpacing: "-0.02em",
                fontFamily: "inherit" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === "cal" && (
        <>
          {Object.keys(hold).length > 0 && (
            <div style={{ margin: "16px 16px 0", background: "#fff", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 28 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>이번 달</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{cv(myMonthPay)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>연간</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#999" }}>{cv(myYearPay)}</div>
                  </div>
                </div>
                <button onClick={() => setCcy(c => c === "USD" ? "KRW" : "USD")}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#f4f5f8", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", color: "#666", fontSize: 13, fontWeight: 600, fontFamily: "inherit", letterSpacing: "-0.02em" }}>
                  <span>{ccy === "USD" ? "USD" : "KRW"}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 16l-4-4 4-4" /><path d="M17 8l4 4-4 4" /><path d="M3 12h18" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div style={{ margin: "12px 16px 0", background: "#fff", borderRadius: 14, padding: "24px 16px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px", marginBottom: 24 }}>
              <button onClick={() => nav(-1)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#ccc", padding: "8px", fontFamily: "inherit" }}>‹</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#aaa", fontWeight: 500, marginBottom: 2 }}>{Y}</div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{M + 1}월</div>
              </div>
              <button onClick={() => nav(1)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#ccc", padding: "8px", fontFamily: "inherit" }}>›</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
              {DA.map((d, i) => (
                <div key={d} style={{ textAlign: "center", fontSize: 12, color: i === 0 ? rd : i === 6 ? "#5b8def" : "#bbb", fontWeight: 500 }}>{d}</div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {grid.map((day, i) => {
                if (day === null) return <div key={`e${i}`} style={{ height: 52 }} />;
                const evts = eForDay(day);
                const isSel = selDay === day;
                const dow = (fd + day - 1) % 7;
                const hasEx = evts.some(e => e.type === "ex");
                const hasPay = evts.some(e => e.type === "pay");
                return (
                  <button key={i} onClick={() => { if (evts.length > 0) { setSelDay(isSel ? null : day); setExpanded(false); } else setSelDay(null); }}
                    style={{ fontFamily: "inherit", letterSpacing: "-0.02em", background: "none", border: "none", padding: 0, height: 52, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", cursor: evts.length > 0 ? "pointer" : "default" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: isToday(day) ? 800 : isSel ? 700 : 400,
                      background: isSel ? nv : isToday(day) ? "#eef0f4" : "transparent",
                      color: isSel ? "#fff" : dow === 0 ? rd : dow === 6 ? "#5b8def" : nv,
                      transition: "all 0.12s"
                    }}>{day}</div>
                    {evts.length > 0 && (
                      <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                        {hasEx && <div style={{ width: 4, height: 4, borderRadius: 4, background: isSel ? "#8a9bc0" : rd }} />}
                        {hasPay && <div style={{ width: 4, height: 4, borderRadius: 4, background: isSel ? "#8a9bc0" : gn }} />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
              {[["배당락", rd], ["지급", gn]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 4, height: 4, borderRadius: 4, background: c }} />
                  <span style={{ fontSize: 11, color: "#aaa" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ margin: "12px 16px 0", background: "#fff", borderRadius: 14, padding: "20px 0 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {selDay ? `${M + 1}월 ${selDay}일` : `${MO_FULL[M]} 배당 일정`}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#aaa" }}>{list.length}건</span>
                {selDay && (
                  <button onClick={() => { setSelDay(null); setExpanded(false); }}
                    style={{ fontFamily: "inherit", background: "none", border: "none", fontSize: 12, color: nv, cursor: "pointer", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>전체</button>
                )}
              </div>
            </div>

            {list.length === 0 && (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#ccc", fontSize: 14 }}>배당 일정이 없습니다</div>
            )}

            {show.map((e, i) => {
              const held = isHeld(e.tk);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "14px 20px",
                  background: held ? "#f8faf9" : "transparent", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                  {!selDay && (
                    <div style={{ width: 28, marginRight: 14, textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: nv }}>{e.day}</div>
                    </div>
                  )}
                  <div style={{ width: 3, height: 28, borderRadius: 2, marginRight: 14, flexShrink: 0, background: e.type === "ex" ? rd : gn, opacity: 0.8 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{e.tk}</span>
                      <span style={{ fontSize: 11, color: e.type === "ex" ? rd : gn, fontWeight: 600 }}>{e.type === "ex" ? "배당락" : "지급"}</span>
                      {held && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, background: nv, padding: "1px 6px", borderRadius: 4 }}>보유</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{e.name}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {e.type === "pay" && held ? (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 800, color: gn }}>{cv(myAmt(e.tk))}</div>
                        <div style={{ fontSize: 10, color: "#bbb", marginTop: 1 }}>{hold[e.tk]}주</div>
                      </>
                    ) : e.type === "pay" ? (
                      <div style={{ fontSize: 13, color: "#bbb" }}>${e.div.toFixed(2)}/주</div>
                    ) : (
                      <div style={{ fontSize: 11, color: rd, fontWeight: 500 }}>전일까지 매수</div>
                    )}
                  </div>
                </div>
              );
            })}

            {list.length > 5 && (
              <button onClick={() => setExpanded(x => !x)}
                style={{ fontFamily: "inherit", letterSpacing: "-0.02em", width: "100%", padding: "16px 0", background: "#fafbfc", border: "none", borderTop: "1px solid #f3f4f6",
                  fontSize: 13, fontWeight: 600, color: nv, cursor: "pointer", borderRadius: "0 0 14px 14px" }}>
                {expanded ? "접기" : `${list.length - 5}건 더보기`}
              </button>
            )}

            {(() => {
              const p = list.filter(e => e.type === "pay" && isHeld(e.tk));
              const t = p.reduce((s, e) => s + myAmt(e.tk), 0);
              return p.length > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px",
                  background: "#f8faf9", borderTop: "1px solid #eef0f2", borderRadius: list.length <= 5 ? "0 0 14px 14px" : 0 }}>
                  <span style={{ fontSize: 13, color: "#888" }}>내 배당 합계</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: gn }}>{cv(t)}</span>
                </div>
              ) : null;
            })()}
          </div>

          {Object.keys(hold).length === 0 && (
            <div style={{ margin: "12px 16px 0", background: "#fff", borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#aaa", lineHeight: 1.6 }}>보유 종목을 추가하면<br />내 배당 금액을 확인할 수 있습니다</div>
              <button onClick={() => { setTab("my"); setMgr(true); }}
                style={{ fontFamily: "inherit", marginTop: 16, padding: "12px 28px", background: nv, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                종목 추가
              </button>
            </div>
          )}

          <div style={{ height: 40 }} />
        </>
      )}

      {tab === "my" && (
        <>
          {Object.keys(hold).length > 0 && !mgr && (
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 20px 0" }}>
              <button onClick={() => setCcy(c => c === "USD" ? "KRW" : "USD")}
                style={{ fontFamily: "inherit", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "none", padding: "7px 14px", borderRadius: 8, cursor: "pointer", color: "#666", fontSize: 13, fontWeight: 600 }}>
                <span>{ccy === "USD" ? "USD" : "KRW"}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16l-4-4 4-4" /><path d="M17 8l4 4-4 4" /><path d="M3 12h18" />
                </svg>
              </button>
            </div>
          )}

          <div style={{ margin: "8px 16px 0" }}>
            <div style={{ background: "#fff", borderRadius: 14, padding: "20px 20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>보유 종목</div>
                <button onClick={() => { setMgr(m => !m); setSearch(""); }}
                  style={{ fontFamily: "inherit", letterSpacing: "-0.02em", background: mgr ? nv : "#eef0f4", border: "none", padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: mgr ? "#fff" : nv }}>
                  {mgr ? "완료" : "편집"}
                </button>
              </div>

              {mgr && (
                <>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="종목 검색"
                    style={{ fontFamily: "inherit", letterSpacing: "-0.02em", width: "100%", padding: "13px 16px", border: "1.5px solid #e8e9ec", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", background: "#fafbfc" }} />
                  <div style={{ marginTop: 4 }}>
                    {filtered.map(([tk, s]) => {
                      const held = isHeld(tk);
                      return (
                        <button key={tk} onClick={() => toggle(tk)}
                          style={{ fontFamily: "inherit", letterSpacing: "-0.02em", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "14px 0",
                            background: "none", border: "none", borderBottom: "1px solid #f5f5f5", cursor: "pointer", textAlign: "left" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{tk}</span>
                            <span style={{ fontSize: 13, color: "#aaa", marginLeft: 10 }}>{s.name}</span>
                          </div>
                          <div style={{ width: 22, height: 22, borderRadius: 6, border: held ? "none" : "2px solid #ddd",
                            background: held ? nv : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {held && <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ height: 16 }} />
                </>
              )}

              {!mgr && Object.keys(hold).length === 0 && (
                <div style={{ padding: "40px 0 48px", textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "#bbb", lineHeight: 1.7 }}>보유 종목을 추가하면<br />배당 일정을 확인할 수 있습니다</div>
                  <button onClick={() => setMgr(true)}
                    style={{ fontFamily: "inherit", marginTop: 20, padding: "12px 32px", background: nv, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                    종목 추가
                  </button>
                </div>
              )}

              {!mgr && Object.keys(hold).length > 0 && (
                <>
                  {Object.entries(hold).map(([tk, shares], idx) => {
                    const s = db[tk]; if (!s) return null;
                    const ann = s.div * shares * (s.freq === "m" ? 12 : 4);
                    return (
                      <div key={tk} style={{ padding: "18px 0", borderTop: idx > 0 ? "1px solid #f3f4f6" : "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: 17, fontWeight: 800 }}>{tk}</span>
                            <span style={{ fontSize: 13, color: "#aaa", marginLeft: 10 }}>{s.name}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 17, fontWeight: 800, color: gn }}>{cv(ann)}</div>
                            <div style={{ fontSize: 11, color: "#bbb" }}>연간</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                          <span style={{ fontSize: 13, color: "#aaa" }}>보유</span>
                          <button onClick={() => setSh(tk, Math.max(0, shares - 1))}
                            style={{ fontFamily: "inherit", width: 32, height: 32, borderRadius: 8, border: "1px solid #e8e9ec", background: "#fafbfc", cursor: "pointer", fontSize: 16, color: "#888" }}>−</button>
                          <input value={shares} onChange={e => setSh(tk, e.target.value)}
                            style={{ fontFamily: "inherit", letterSpacing: "-0.02em", width: 56, textAlign: "center", padding: "6px 0", border: "1px solid #e8e9ec", borderRadius: 8, fontSize: 16, fontWeight: 700, background: "#fafbfc" }} />
                          <button onClick={() => setSh(tk, shares + 1)}
                            style={{ fontFamily: "inherit", width: 32, height: 32, borderRadius: 8, border: "1px solid #e8e9ec", background: "#fafbfc", cursor: "pointer", fontSize: 16, color: "#888" }}>+</button>
                          <span style={{ fontSize: 13, color: "#ccc" }}>주</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ height: 8 }} />
                </>
              )}
            </div>

            {!mgr && Object.keys(hold).length > 0 && (
              <div style={{ background: nv, borderRadius: 14, padding: "20px", color: "#fff", marginTop: 12 }}>
                {[["투자금액", cv(Object.entries(hold).reduce((s, [t, n]) => s + (db[t]?.price || 0) * n, 0)), "rgba(255,255,255,0.9)"],
                  ["연간 배당", cv(myYearPay), "#4cd964"],
                  ["수익률", (Object.entries(hold).reduce((s, [t, n]) => s + (db[t]?.price || 0) * n, 0) > 0 ? (myYearPay / Object.entries(hold).reduce((s, [t, n]) => s + (db[t]?.price || 0) * n, 0) * 100).toFixed(2) : "0.00") + "%", "rgba(255,255,255,0.9)"]
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{l}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 40 }} />
        </>
      )}

      <div style={{ padding: "0 24px 36px", fontSize: 11, color: "#ccc", textAlign: "center" }}>
        {!apiReady && "기본 데이터 사용중 · "}배당 일정 및 금액은 예상치입니다 · 환율 1 USD = {EXR.toLocaleString()} KRW
      </div>
    </div>
  );
}
