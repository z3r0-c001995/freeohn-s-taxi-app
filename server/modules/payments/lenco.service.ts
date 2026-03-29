import { lencoConfig } from "./lenco.config";

export interface LencoPaymentLinkRequest {
  reference: string;
  amount: number;
  currency: string;
  title: string;
  description?: string;
}

export interface LencoPaymentLinkResponse {
  status: boolean;
  message: string;
  data: {
    id: string;
    url: string;
    reference: string;
    amount: number;
  };
}

export class LencoApiService {
  /**
   * Create a payment link for collection
   */
  async createPaymentLink(payload: LencoPaymentLinkRequest): Promise<LencoPaymentLinkResponse> {
    const url = `${lencoConfig.baseUrl}/payment-links`;
    
    // We will use standard fetch for these requests
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lencoConfig.apiKey}`
      },
      body: JSON.stringify({
        reference: payload.reference,
        amount: payload.amount,
        currency: payload.currency,
        title: payload.title,
        description: payload.description,
        redirectUrl: lencoConfig.webhookUrl, // Redirect users after payment if supported
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown exact error");
      throw new Error(`Failed to create Lenco payment link: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }
}

export const lencoApiService = new LencoApiService();
