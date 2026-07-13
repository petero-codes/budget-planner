export class PeriodRange {
  readonly from: string;
  readonly to: string;

  private constructor(from: string, to: string) {
    this.from = from;
    this.to = to;
  }

  static create(from: string, to: string): PeriodRange {
    if (!from || !to) {
      throw new Error("From and To periods are required");
    }
    if (from > to) {
      throw new Error("From period must be on or before To period");
    }
    return new PeriodRange(from, to);
  }
}
