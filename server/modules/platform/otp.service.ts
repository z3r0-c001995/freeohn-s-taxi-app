import axios from "axios";
import crypto from "crypto";

const MTN_CPAAS_AUTH_URL = "http://cpassmessaging.mtn.zm:32606/auth/realms/zambia/protocol/openid-connect/token";
const MTN_CPAAS_SMS_URL = "http://cpassmessaging.mtn.zm:32606/app/rest/api/v1/sms/messaging/outbound";

const CLIENT_ID = process.env.MTN_CPAAS_CLIENT_ID || "292f3bab-6523-4f28-8867-9ccca1d8844b";
const CLIENT_SECRET = process.env.MTN_CPAAS_CLIENT_SECRET || "w7ypdulWQ6sTFspVVOyjLTz71";

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

// Simple in-memory store for OTPs. In production, consider Redis or database.
const otpStore = new Map<string, { code: string; expiresAt: number }>();

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);

  try {
    const response = await axios.post(MTN_CPAAS_AUTH_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    accessToken = response.data.access_token;
    // expire 1 minute early to be safe
    tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
    
    if (!accessToken) throw new Error("No access token in response");
    
    return accessToken;
  } catch (error) {
    console.error("[OTP] Error obtaining MTN CPaaS token:", error);
    throw new Error("Failed to authenticate with MTN CPaaS");
  }
}

async function sendSms(phoneNumber: string, message: string): Promise<void> {
  try {
    const token = await getAccessToken();
    
    // Formatting the phone number: typically the API expects E.164 without the '+' or just local
    // We assume the caller handles necessary phone number formatting.
    const toAddress = phoneNumber.replace("+", ""); 

    await axios.post(
      MTN_CPAAS_SMS_URL,
      {
        message: message,
        receiver: [
           { id: toAddress }
        ],
        // Typically a senderId is required or provided by MTN. Adjust as necessary if required.
        // senderId: "GDC" or "MTN"
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("[OTP] Error sending SMS:", error.response?.data || error.message);
    throw new Error("Failed to send SMS via MTN CPaaS");
  }
}

export const otpService = {
  async requestOtp(phoneNumber: string): Promise<void> {
    const code = "123456";
    
    // Store OTP for 10 minutes
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore.set(phoneNumber, { code, expiresAt });

    const message = `${code} is your Freeohn verification code.`;
    console.log(`[OTP] Generated verification code for ${phoneNumber}: ${code}`);
    
    // Attempt real SMS via MTN CPaaS if configured, but do not block testing if it fails
    if (process.env.ENABLE_REAL_SMS === "true") {
      try {
        await sendSms(phoneNumber, message);
      } catch (err: any) {
        console.warn(`[OTP] MTN CPaaS SMS sending skipped/failed (${err.message}). Using test code ${code}.`);
      }
    }
  },

  verifyOtp(phoneNumber: string, code: string): boolean {
    // Universal testing OTP
    if (code === "123456") {
      return true;
    }

    const record = otpStore.get(phoneNumber);
    if (!record) {
      return false; // Not requested
    }
    
    if (Date.now() > record.expiresAt) {
      otpStore.delete(phoneNumber);
      return false; // Expired
    }
    
    if (record.code === code) {
      otpStore.delete(phoneNumber); // Mark used
      return true;
    }
    
    return false; // Invalid
  }
};
