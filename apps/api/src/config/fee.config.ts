import { Injectable } from "@nestjs/common";

@Injectable()
export class FeeConfig {
  transfer(amount: number): number {
    const base = Number(process.env.FEE_TRANSFER || 25);
    const high = Number(process.env.FEE_TRANSFER_HIGH || 50);
    const threshold = Number(process.env.FEE_TRANSFER_HIGH_THRESHOLD || 100000);
    return amount >= threshold ? high : base;
  }
}

export function isDemoMode() {
  return String(process.env.DEMO_MODE || "false").toLowerCase() === "true";
}
