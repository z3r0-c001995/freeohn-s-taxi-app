import type { PaymentMethod } from "../../../shared/ride-hailing";

export type PaymentCaptureInput = {
  tripId: string;
  riderId: number;
  driverId: string;
  amount: number;
  currency: "USD";
};

export type PaymentCaptureResult = {
  status: "COMPLETED" | "PENDING";
  method: PaymentMethod;
  referenceId: string;
};

interface PaymentHandler {
  capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult>;
}

class CashPaymentHandler implements PaymentHandler {
  async capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult> {
    return {
      status: "PENDING",
      method: "CASH",
      referenceId: `cash_${input.tripId}`,
    };
  }
}

export class PaymentService {
  private readonly handlers: Record<PaymentMethod, PaymentHandler> = {
    CASH: new CashPaymentHandler(),
  };

  async capture(method: PaymentMethod, input: PaymentCaptureInput): Promise<PaymentCaptureResult> {
    const handler = this.handlers[method];
    if (!handler) {
      throw new Error(`Unsupported payment method: ${method}`);
    }
    return handler.capture(input);
  }
}

export const paymentService = new PaymentService();

