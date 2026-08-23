import type { PaymentMethod } from "../../../shared/ride-hailing";
import { lencoApiService } from "./lenco.service";
export type PaymentCaptureInput = {
  tripId: string;
  riderId: number;
  driverId: string;
  amount: number;
  currency: "ZMW" | "USD" | string;
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

class MobileMoneyPaymentHandler implements PaymentHandler {
  async capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult> {
    return {
      status: "PENDING",
      method: "MOBILE_MONEY",
      referenceId: `momo_${input.tripId}`,
    };
  }
}

class LencopayPaymentHandler implements PaymentHandler {
  async capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult> {
    const response = await lencoApiService.createPaymentLink({
      reference: `trip_${input.tripId}`,
      amount: input.amount,
      currency: input.currency,
      title: "Ride Payment",
      description: `Payment for trip ${input.tripId}`,
    });

    return {
      status: "PENDING",
      method: "LENCOPAY",
      referenceId: response.data.url, // Store the payment checkout link
    };
  }
}

export class PaymentService {
  private readonly handlers: Record<PaymentMethod, PaymentHandler> = {
    CASH: new CashPaymentHandler(),
    MOBILE_MONEY: new MobileMoneyPaymentHandler(),
    LENCOPAY: new LencopayPaymentHandler(),
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

