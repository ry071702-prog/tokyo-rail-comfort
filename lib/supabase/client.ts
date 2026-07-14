import { createBrowserClient } from "@supabase/ssr";

// ブラウザ用クライアント。anon key のみ使用（service role は絶対に渡さない）
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
