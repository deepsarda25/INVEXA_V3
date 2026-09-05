/**
 * OrderValidator — Single Responsibility: validate order business rules.
 * Separated from order entity creation (SRP, GRASP Information Expert).
 */
import { getMarketSession } from "../market/marketHours";

export type ValidationContext = {
  balance: number;
  holdings: number;
  livePrice: number;
};

export type OrderPayload = {
  ticker: string;
  type: "market" | "limit" | "stop_loss";
  side: "buy" | "sell";
  quantity: number;
  limitPrice?: number | null;
};

export class OrderValidator {
  /**
   * Validates common rules for all order types.
   * Throws with a descriptive message on failure.
   */
  static validateCommon(payload: OrderPayload, ctx: ValidationContext): void {
    if (payload.quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    const session = getMarketSession(payload.ticker);
    if (!session.open) {
      throw new Error(
        `${session.exchange} is closed right now, so ${payload.ticker.toUpperCase()} can't be traded. Trading hours: ${session.hours}.`
      );
    }

    if (payload.side === "buy") {
      const referencePrice = payload.limitPrice ?? ctx.livePrice;
      const required = referencePrice * payload.quantity;
      if (ctx.balance < required) {
        throw new Error(
          `Insufficient virtual balance. Need ₹${required.toFixed(2)}, have ₹${ctx.balance.toFixed(2)}`
        );
      }
    }

    if (payload.side === "sell") {
      // Short selling is not allowed: a stock can only be sold if it is
      // already part of the portfolio, and only up to the quantity held.
      if (ctx.holdings <= 0) {
        throw new Error(
          `You don't own any ${payload.ticker.toUpperCase()} — it isn't part of your portfolio, so it can't be sold.`
        );
      }
      if (payload.quantity > ctx.holdings) {
        throw new Error(
          `Insufficient holdings. You own ${ctx.holdings} share(s) of ${payload.ticker.toUpperCase()}, but tried to sell ${payload.quantity}.`
        );
      }
    }
  }

  /** Additional validation specific to limit orders. */
  static validateLimitPrice(payload: OrderPayload): void {
    if (!payload.limitPrice || payload.limitPrice <= 0) {
      throw new Error("Limit orders require a positive limitPrice");
    }
  }

  /** Additional validation specific to stop-loss orders. */
  static validateTriggerPrice(payload: OrderPayload): void {
    if (!payload.limitPrice || payload.limitPrice <= 0) {
      throw new Error("Stop-loss orders require a positive trigger price");
    }
  }
}
