export interface TickerFormattingStrategy {
  format(ticker: string): string;
}

export class USFormattingStrategy implements TickerFormattingStrategy {
  format(ticker: string): string {
    return ticker.trim().toUpperCase();
  }
}

export class SIMFormattingStrategy implements TickerFormattingStrategy {
  format(ticker: string): string {
    return ticker.trim().toUpperCase();
  }
}

export class NSEFormattingStrategy implements TickerFormattingStrategy {
  format(ticker: string): string {
    const t = ticker.trim().toUpperCase();
    return t.includes(".") ? t : `${t}.NS`;
  }
}

export class BSEFormattingStrategy implements TickerFormattingStrategy {
  format(ticker: string): string {
    const t = ticker.trim().toUpperCase();
    return t.includes(".") ? t : `${t}.BO`;
  }
}

export class TickerFormatter {
  private strategy: TickerFormattingStrategy;

  constructor(strategy: TickerFormattingStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: TickerFormattingStrategy) {
    this.strategy = strategy;
  }

  format(ticker: string): string {
    return this.strategy.format(ticker);
  }
}
