import { FormEvent, useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { useMarketStore } from "../store/marketStore";
import { 
  TickerFormatter, 
  USFormattingStrategy, 
  NSEFormattingStrategy, 
  BSEFormattingStrategy
} from "../utils/tickerStrategy";

type Props = {
  onOrderPlaced: () => void;
  initialTicker?: string;
  onTickerChange?: (formattedTicker: string) => void;
  competitionId?: string;
  dbTicker?: string;
  lockTicker?: boolean;
};

type MarketStatus = { ticker: string; open: boolean; exchange: string; hours: string };

const ORDER_TYPE_INFO: Record<string, string> = {
  market: "Executes immediately at the current live market price.",
  limit: "Queued order that executes only when the price reaches your target.",
  stop_loss: "Automatically sells your position if the price drops to your trigger."
};

export function OrderForm({ onOrderPlaced, initialTicker, onTickerChange, competitionId, dbTicker, lockTicker }: Props) {
  const prices = useMarketStore((s) => s.prices);
  const isLocked = Boolean(competitionId) || Boolean(lockTicker);

  // Derive initial values from initialTicker
  let initExch: "US" | "NSE" | "BSE" = "NSE";
  let initSym = "RELIANCE";
  if (initialTicker) {
    if (initialTicker.endsWith(".NS")) { initExch = "NSE"; initSym = initialTicker.replace(".NS", ""); }
    else if (initialTicker.endsWith(".BO")) { initExch = "BSE"; initSym = initialTicker.replace(".BO", ""); }
    else { initExch = "US"; initSym = initialTicker; }
  }

  const [exchange, setExchange] = useState<"US" | "NSE" | "BSE">(initExch);
  const [ticker, setTicker] = useState(initSym);
  const [type, setType] = useState<"market" | "limit" | "stop_loss">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState(10);
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  const formatter = useMemo(() => {
    let strategy = new USFormattingStrategy();
    if (exchange === "NSE") strategy = new NSEFormattingStrategy();
    else if (exchange === "BSE") strategy = new BSEFormattingStrategy();
    return new TickerFormatter(strategy);
  }, [exchange]);

  const formattedTicker = formatter.format(ticker || "RELIANCE");
  const livePrice = prices[dbTicker || formattedTicker]?.price;

  const marketStatusQuery = useQuery({
    queryKey: ["market-status", formattedTicker],
    queryFn: () => apiFetch<MarketStatus>(`/stocks/${formattedTicker}/market-status`),
    enabled: Boolean(formattedTicker),
    refetchInterval: 30000
  });
  const marketClosed = marketStatusQuery.data ? !marketStatusQuery.data.open : false;

  useEffect(() => {
    if (initialTicker && initialTicker !== formattedTicker) {
      if (initialTicker.endsWith(".NS")) { setExchange("NSE"); setTicker(initialTicker.replace(".NS", "")); }
      else if (initialTicker.endsWith(".BO")) { setExchange("BSE"); setTicker(initialTicker.replace(".BO", "")); }
      else { setExchange("US"); setTicker(initialTicker); }
    }
  }, [initialTicker]); 

  useEffect(() => {
    if (onTickerChange && formattedTicker !== "") {
      onTickerChange(formattedTicker);
    }
  }, [formattedTicker, onTickerChange]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await apiFetch<{ orderId: string; status: string; note: string }>(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({
            ticker: formattedTicker,
            type,
            side,
            quantity,
            ...(type !== "market" && limitPrice > 0 ? { limitPrice } : {}),
            ...(competitionId ? { competitionId } : {})
          })
        }
      );
      setMessage({ text: `✓ Order ${res.orderId.slice(0, 8)}… accepted — ${res.note}`, kind: "success" });
      onOrderPlaced();
    } catch (error) {
      setMessage({ text: (error as Error).message, kind: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Place Order</h2>
        {livePrice && (
          <span style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>
            {formattedTicker} · <strong style={{ color: "var(--text)" }}>
              ₹{livePrice.toFixed(2)}
            </strong>
          </span>
        )}
      </div>

      <form className="order-form" onSubmit={submit}>
        {/* BUY / SELL toggle */}
        <div className="side-toggle">
          <button
            type="button"
            className={`side-btn buy ${side === "buy" ? "active" : ""}`}
            onClick={() => setSide("buy")}
          >
            ▲ BUY
          </button>
          <button
            type="button"
            className={`side-btn sell ${side === "sell" ? "active" : ""}`}
            onClick={() => setSide("sell")}
          >
            ▼ SELL
          </button>
        </div>

        {/* Exchange Toggle */}
        {!isLocked && (
          <label className="form-label">
            Exchange
            <select
              className="form-select"
              value={exchange}
              onChange={(e) => setExchange(e.target.value as any)}
            >
              <option value="NSE">NSE (India)</option>
              <option value="BSE">BSE (India)</option>
              <option value="US">US Market</option>
            </select>
          </label>
        )}

        {/* Ticker */}
        {isLocked ? (
          <div className="label-sm" style={{ color: "var(--text-3)" }}>
            Trading <strong style={{ color: "var(--on-surface)" }}>{formattedTicker}</strong>
          </div>
        ) : (
          <label className="form-label">
            Ticker Symbol
            <input
              className="form-input"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder={exchange === "US" ? "e.g. AAPL" : "e.g. RELIANCE"}
            />
          </label>
        )}

        {/* Order Type */}
        <label className="form-label">
          Order Type
          <select
            className="form-select"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            <option value="market">Market Order</option>
            <option value="limit">Limit Order</option>
            <option value="stop_loss">Stop-Loss Order</option>
          </select>
        </label>

        {/* Type info tooltip */}
        <div className="order-type-info">{ORDER_TYPE_INFO[type]}</div>

        {/* Quantity */}
        <label className="form-label">
          Quantity
          <input
            className="form-input"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>

        {/* Limit / trigger price */}
        {type !== "market" && (
          <label className="form-label">
            {type === "limit" ? "Limit Price (₹)" : "Trigger Price (₹)"}
            <input
              className="form-input"
              type="number"
              step="0.01"
              min={0.01}
              value={limitPrice || ""}
              placeholder={livePrice ? livePrice.toFixed(2) : "0.00"}
              onChange={(e) => setLimitPrice(Number(e.target.value))}
            />
          </label>
        )}

        <button
          type="submit"
          className={`btn-order ${side}`}
          disabled={loading || marketClosed}
          title={marketClosed ? `${marketStatusQuery.data?.exchange} is closed — trading resumes during its listed hours` : undefined}
        >
          {loading
            ? "Placing…"
            : marketClosed
              ? "Market Closed"
              : `${side === "buy" ? "Buy" : "Sell"} ${ticker.toUpperCase() || "—"}`}
        </button>
      </form>

      {message && (
        <p className={`order-msg ${message.kind}`}>{message.text}</p>
      )}
    </div>
  );
}
