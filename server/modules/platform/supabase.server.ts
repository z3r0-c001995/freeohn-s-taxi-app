import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://ogbwfaiejixjegcczcqw.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_IbQqLGezxRofPrLHsyurOg_kBD24tyF";

export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Verify a Supabase JWT access token on the backend.
 */
export async function verifySupabaseToken(accessToken: string) {
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(accessToken);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (err) {
    console.error("[SupabaseServer] Token verification failed:", err);
    return null;
  }
}
