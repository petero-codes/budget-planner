export class Money {
  readonly amount: number;
  readonly currency: string;

  private constructor(amount: number, currency: string) {
    this.amount = amount;
    this.currency = currency;
  }

  static create(amount: number, currency = "KES"): Money {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
      throw new Error("Amount is required");
    }
    if (!Number.isInteger(amount)) {
      throw new Error("Amount must be a whole number");
    }
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }
    return new Money(amount, currency);
  }
}
