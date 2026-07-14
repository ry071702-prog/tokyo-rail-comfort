import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// scripts/ のデータ投入専用。service role key を使うためサーバ/バッチ以外から import しない
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です"
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
