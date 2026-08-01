import { Injectable } from "@nestjs/common";
import { EventEmitter } from "events";

export type ResiliaEvent =
  | { type: "auth.login"; userId: string; deviceId: string; newDevice: boolean }
  | {
      type: "payment.initiated";
      transactionId: string;
      userId: string;
      amount: number;
      counterparty: string;
      category: string;
    }
  | {
      type: "payment.held";
      transactionId: string;
      userId: string;
      riskScore: number;
      reason: string;
    }
  | {
      type: "payment.settled";
      transactionId: string;
      userId: string;
      amount: number;
    }
  | {
      type: "payment.rejected";
      transactionId: string;
      userId: string;
      reason: string;
    }
  | {
      type: "security.freeze";
      userId: string;
      target: "card" | "account";
      targetId: string;
    }
  | {
      type: "loan.submitted";
      loanId: string;
      userId: string;
      amount: number;
    }
  | {
      type: "loan.decided";
      loanId: string;
      status: "APPROVED" | "REJECTED";
      actor: string;
    }
  | {
      type: "dispute.decided";
      disputeId: string;
      userId: string;
      status: "RESOLVED" | "REJECTED";
      refunded: boolean;
      resolution: string;
      actor: string;
    }
  | {
      type: "kyc.decided";
      userId: string;
      status: "VERIFIED" | "REJECTED";
      note: string;
      actor: string;
    };

type Handler = (event: ResiliaEvent) => void | Promise<void>;

@Injectable()
export class EventBusService {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  on(handler: Handler) {
    this.emitter.on("event", handler);
  }

  async publish(event: ResiliaEvent) {
    const listeners = this.emitter.listeners("event") as Handler[];
    for (const listener of listeners) {
      await listener(event);
    }
  }
}
