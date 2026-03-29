import { z } from "zod";

const lencoConfigSchema = z.object({
  apiKey: z.string().default("b1525778a31640a00483007fc3a3aafd81f70080d4da5d3097ba4f34dc944303"),
  publicKey: z.string().default("pub-383b98bc59ceabc1e70efb5090ac378f91837ea90af3019d"),
  signatureKey: z.string().default("870b8e44f70301a9de4e1ec55dfbb458ac85cc80bea2bbda267b70b8598be574"),
  webhookUrl: z.string().default("add_temporal_url"),
  baseUrl: z.string().default("https://api.lenco.co/access/v2"),
});

export const lencoConfig = lencoConfigSchema.parse({
  apiKey: process.env.LENCO_API_KEY,
  publicKey: process.env.LENCO_PUBLIC_KEY,
  signatureKey: process.env.LENCO_SIGNATURE_KEY,
  webhookUrl: process.env.LENCO_WEBHOOK_URL,
  baseUrl: process.env.LENCO_BASE_URL,
});
