import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // M0 AC: Supabase クライアントが env から初期化されることを確認
  let supabaseReady = false;
  try {
    await createClient();
    supabaseReady = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  } catch {
    supabaseReady = false;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">東京レイルコンフォート</h1>
      <p className="max-w-xl text-center text-sm text-gray-600 dark:text-gray-300">
        東京の電車の混雑を「統計 × 時刻表」で時間帯別に推定し、
        リアルタイムの運行情報（遅延）で補正して可視化します
      </p>
      <p className="rounded border border-amber-400 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        表示される混雑度は実測ではなく推定です
      </p>
      <p className="text-xs text-gray-500">
        Supabase クライアント初期化: {supabaseReady ? "OK" : "env 未設定"}
      </p>
      <footer className="text-xs text-gray-400">
        本アプリは公共交通オープンデータセンターのデータを利用しています
      </footer>
    </main>
  );
}
