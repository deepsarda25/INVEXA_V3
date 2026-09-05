import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api/client";
import { AuthPage } from "./components/AuthPage";
import { IndexTicker } from "./components/IndexTicker";
import { HoldingsCard } from "./components/HoldingsCard";
import { PortfolioAllocationChart } from "./components/PortfolioAllocationChart";
import { ProfilePanel } from "./components/ProfilePanel";
import { StockResearch } from "./components/StockResearch";
import { WatchlistCard } from "./components/WatchlistCard";
import { ThemeToggleIcon } from "./components/ThemeToggleIcon";
import { usePriceSocket } from "./hooks/usePriceSocket";
import { useTheme } from "./hooks/useTheme";
import { useAuthStore } from "./store/authStore";
import { useMarketStore } from "./store/marketStore";
import { getRecentlyViewed, addRecentlyViewed } from "./utils/recentlyViewed";

type StocksResponse = { stocks: Array<{ ticker: string; price: number; ts: number }> };
type PortfolioResponse = {
  cash: number;
  totalHoldingsValue: number;
  totalPortfolioValue: number;
  totalUnrealizedPnl: number;
  holdings: Array<{
    ticker: string;
    quantity: number;
    avgCost: number;
    livePrice: number;
    marketValue: number;
    unrealizedPnl: number;
  }>;
};
type WatchlistListMeta = { id: string; name: string; createdAt: string; count: number };
type WatchlistResponse = {
  listId: string;
  watchlist: Array<{
    id: string;
    ticker: string;
    targetPrice: number | null;
    livePrice: number | null;
    targetHit: boolean | null;
  }>;
};

type Tab = "market" | "research" | "watchlist" | "holdings" | "profile";

const TABS: { id: Tab; label: string; }[] = [
  { id: "market", label: "Dashboard" },
  { id: "research", label: "Terminal" },
  { id: "watchlist", label: "Watchlist" },
  { id: "holdings", label: "Holdings" },
  { id: "profile", label: "Profile" }
];

export default function App() {
  usePriceSocket();

  const auth = useAuthStore();
  const prices = useMarketStore((state) => state.prices);
  const [activeTab, setActiveTab] = useState<Tab>("market");
  const [terminalTicker, setTerminalTicker] = useState<string>("RELIANCE.NS");
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => getRecentlyViewed());
  const { theme, toggleTheme } = useTheme();

  // Track terminal-side ticker views too (research page tracks its own), and
  // refresh the "Recently Viewed" list whenever the dashboard comes into view.
  useEffect(() => {
    addRecentlyViewed(terminalTicker);
  }, [terminalTicker]);

  useEffect(() => {
    if (activeTab === "market") {
      setRecentlyViewed(getRecentlyViewed());
    }
  }, [activeTab]);

  const stocksQuery = useQuery({
    queryKey: ["stocks"],
    queryFn: () => apiFetch<StocksResponse>("/stocks"),
    refetchInterval: 5000
  });

  const portfolioQuery = useQuery({
    queryKey: ["portfolio", auth.token],
    queryFn: () => apiFetch<PortfolioResponse>("/portfolio", {}, auth.token!),
    enabled: Boolean(auth.token),
    refetchInterval: 8000
  });

  const watchlistListsQuery = useQuery({
    queryKey: ["watchlist-lists", auth.token],
    queryFn: () => apiFetch<{ lists: WatchlistListMeta[] }>("/watchlist/lists", {}, auth.token!),
    enabled: Boolean(auth.token),
    refetchInterval: 30000
  });
  const defaultWatchlistId = watchlistListsQuery.data?.lists[0]?.id;

  const watchlistQuery = useQuery({
    queryKey: ["watchlist", defaultWatchlistId],
    queryFn: () => apiFetch<WatchlistResponse>(`/watchlist/lists/${defaultWatchlistId}`, {}, auth.token!),
    enabled: Boolean(auth.token) && Boolean(defaultWatchlistId),
    refetchInterval: 15000
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Listen to strategy events
  const strategyEvent = useMarketStore(s => s.strategyEvent);
  

  const holdingsList = portfolioQuery.data?.holdings ?? [];
  const rankedHoldings = useMemo(() => {
    return [...holdingsList]
      .map((h) => ({ ...h, pct: h.avgCost > 0 ? ((h.livePrice - h.avgCost) / h.avgCost) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [holdingsList]);
  const bestPerformer = rankedHoldings[0];
  const worstPerformer = rankedHoldings.length > 1 ? rankedHoldings[rankedHoldings.length - 1] : undefined;

  useEffect(() => {
    if (strategyEvent && auth.user?.role === "user") {
      let niceName = strategyEvent.strategy;
      if (niceName === "circuit_breaker") niceName = "Market Crash";
      if (niceName === "mean_reversion") niceName = "Market Recovery";
      if (niceName === "random_walk") niceName = "Normal Trading";
      if (niceName === "user_influence") niceName = "Live Trader Influence";
      
      setToastMessage(`⚠️ Global Event: ${niceName} Strategy Activated!`);
      const t = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [strategyEvent?.id, strategyEvent?.strategy, auth.user?.role]);

  // Show auth page if not logged in
  if (!auth.user) {
    return <AuthPage />;
  }

  const initials = auth.user.username.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: "20px", right: "20px", zIndex: 9999,
          background: "var(--color-danger)", color: "white", padding: "1rem 2rem",
          borderRadius: "8px", fontWeight: "bold",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          animation: "fadein 0.3s ease-out"
        }}>
          {toastMessage}
        </div>
      )}
      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <img
                src={theme === "dark" ? "/assets/invexa-logo-dark.png" : "/assets/invexa-logo-light.png"}
                alt="Invexa"
                style={{ height: "1.6rem", width: "1.6rem", borderRadius: "0.3rem", objectFit: "cover" }}
              />
              <h1 className="headline-sm">Invexa</h1>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  style={{
                    background: "none",
                    color: activeTab === tab.id ? "var(--on-surface)" : "var(--on-surface-variant)",
                    fontFamily: "var(--font-body)",
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    borderBottom: activeTab === tab.id ? "2px solid var(--primary-container)" : "2px solid transparent",
                    paddingBottom: "0.5rem",
                    borderRadius: 0
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
            <button className="btn-primary" style={{ padding: "0.5rem 1.5rem" }} onClick={() => setActiveTab("research")}>Trade</button>
            <button className="profile-avatar" onClick={() => setActiveTab("profile")} title="Open profile">
              {initials}
            </button>
            <button 
              className="btn-primary sell" 
              style={{ padding: "0.5rem 1rem", borderRadius: "100px", fontWeight: "bold", fontSize: "0.85rem" }}
              onClick={() => void auth.logout()}
            >
              Logout
            </button>
          </div>
        </header>

        <div className="content-area">
          <IndexTicker onSelect={(t) => { setTerminalTicker(t); setActiveTab("research"); }} />

          {/* ── Dashboard (Market) Tab ── */}
          {activeTab === "market" && (
            <>
              {/* Stat strip */}
              <div className="stats-row" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                <div className="stat-cell">
                  <span>Total Portfolio Value</span>
                  <strong className="headline-sm">
                    ₹{portfolioQuery.data?.totalPortfolioValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                  </strong>
                </div>
                <div className="stat-cell">
                  <span>Buying Power</span>
                  <strong className="headline-sm">
                    ₹{portfolioQuery.data?.cash.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                  </strong>
                </div>
                <div className="stat-cell">
                  <span>Unrealized P&amp;L</span>
                  <strong className={((portfolioQuery.data?.totalUnrealizedPnl ?? 0) >= 0) ? 'good headline-sm' : 'bad headline-sm'}>
                    {((portfolioQuery.data?.totalUnrealizedPnl ?? 0) >= 0) ? '+' : ''}
                    ₹{portfolioQuery.data?.totalUnrealizedPnl.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                  </strong>
                </div>
                <div className="stat-cell">
                  <span>Holdings</span>
                  <strong className="headline-sm">{holdingsList.length} stock{holdingsList.length === 1 ? "" : "s"}</strong>
                </div>
              </div>

              <div className="grid-2">
                {/* Asset Allocation */}
                <div className="card">
                  <div className="card-header">
                    <h2 className="title-sm">Asset Allocation</h2>
                  </div>
                  <div style={{ height: "220px" }}>
                    <PortfolioAllocationChart cash={portfolioQuery.data?.cash ?? 0} holdings={holdingsList} />
                  </div>
                </div>

                {/* Performance Insight */}
                <div className="card">
                  <div className="card-header">
                    <h2 className="title-sm">Portfolio Insight</h2>
                  </div>
                  {holdingsList.length === 0 ? (
                    <p className="muted" style={{ padding: "0.5rem 0" }}>
                      No holdings yet — buy your first stock from the Terminal to see performance insights here.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {bestPerformer && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div className="label-sm">Best Performer</div>
                            <div className="title-sm" style={{ marginTop: "0.15rem" }}>{bestPerformer.ticker}</div>
                          </div>
                          <div className={bestPerformer.pct >= 0 ? "good headline-sm" : "bad headline-sm"}>
                            {bestPerformer.pct >= 0 ? "+" : ""}{bestPerformer.pct.toFixed(2)}%
                          </div>
                        </div>
                      )}
                      {worstPerformer && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div className="label-sm">Needs Attention</div>
                            <div className="title-sm" style={{ marginTop: "0.15rem" }}>{worstPerformer.ticker}</div>
                          </div>
                          <div className={worstPerformer.pct >= 0 ? "good headline-sm" : "bad headline-sm"}>
                            {worstPerformer.pct >= 0 ? "+" : ""}{worstPerformer.pct.toFixed(2)}%
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.5rem", borderTop: "1px solid var(--outline-variant)" }}>
                        <div>
                          <div className="label-sm">Cash Allocation</div>
                        </div>
                        <div className="title-sm">
                          {portfolioQuery.data && portfolioQuery.data.totalPortfolioValue > 0
                            ? ((portfolioQuery.data.cash / portfolioQuery.data.totalPortfolioValue) * 100).toFixed(1)
                            : "0.0"}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid-2">
                {/* Watchlist Snapshot */}
                <div className="card">
                  <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 className="title-sm">Watchlist Snapshot</h2>
                    <button className="btn-sm" onClick={() => setActiveTab("watchlist")}>View All</button>
                  </div>
                  {(watchlistQuery.data?.watchlist.length ?? 0) === 0 ? (
                    <p className="muted" style={{ padding: "0.5rem 0" }}>
                      Nothing on your watchlist yet — track a stock from Asset Research.
                    </p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ticker</th>
                          <th>Live Price</th>
                          <th>Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {watchlistQuery.data!.watchlist.slice(0, 5).map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.ticker}</strong></td>
                            <td>{item.livePrice ? `₹${item.livePrice.toFixed(2)}` : "—"}</td>
                            <td>
                              {item.targetPrice
                                ? item.targetHit
                                  ? <span className="good">Hit ₹{item.targetPrice.toFixed(2)}</span>
                                  : `₹${item.targetPrice.toFixed(2)}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card">
                  <div className="card-header">
                    <h2 className="title-sm">Recently Viewed</h2>
                  </div>
                  {recentlyViewed.length === 0 ? (
                    <p className="muted" style={{ padding: "0.5rem 0" }}>
                      Stocks you view in the Terminal will show up here.
                    </p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ticker</th>
                          <th>Live Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentlyViewed.slice(0, 5).map((t) => (
                          <tr
                            key={t}
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              setTerminalTicker(t);
                              setActiveTab("research");
                            }}
                          >
                            <td><strong>{t}</strong></td>
                            <td>{prices[t]?.price ? `₹${prices[t].price.toFixed(2)}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </>
          )}
          {activeTab === "research" && auth.token && (
            <StockResearch token={auth.token} initialTicker={terminalTicker} />
          )}

          {/* ── Watchlist Tab ── */}
          {activeTab === "watchlist" && auth.token && (
            <WatchlistCard
              token={auth.token}
              onTrade={(t) => {
                setTerminalTicker(t);
                setActiveTab("research");
              }}
            />
          )}

          {/* ── Holdings Tab ── */}
          {activeTab === "holdings" && (
            <HoldingsCard
              data={portfolioQuery.data}
              onTrade={(t) => {
                setTerminalTicker(t);
                setActiveTab("research");
              }}
            />
          )}

          {activeTab === "profile" && (
            <ProfilePanel
              user={auth.user}
              token={auth.token}
              portfolio={portfolioQuery.data}
              onLogout={() => void auth.logout()}
              onBalanceChanged={() => void portfolioQuery.refetch()}
            />
          )}
        </div>
      </main>
    </div>
  );
}
