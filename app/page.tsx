import { ComfortDashboard } from "@/components/ComfortDashboard";
import { DemoBadge } from "@/components/DemoBadge";

// M4: 可視化 UI（まずはモックデータで動く状態）。
// 全画面共通で「推定です」注記・出典表示・dc:date を担保する。
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      {/* ヘッダー */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            東京レイルコンフォート
          </h1>
          <DemoBadge />
        </div>
        <p className="max-w-2xl text-sm text-gray-600">
          東京の電車の混雑を「統計 × 時刻表」で時間帯別に推定し、リアルタイムの運行情報（遅延）で補正して可視化します
          空いている時間帯を選んで、オフピーク移動で手取り時間を増やしましょう
        </p>
        {/* 「推定です」注記（全画面で常時表示） */}
        <p className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          ⚠️ 表示される混雑度は実測ではなく推定です（統計 × 時刻表 × 運行情報から算出）
          現在の数値はデモデータで、実データへの差し替え前のプレースホルダです
        </p>
      </header>

      {/* ダッシュボード本体 */}
      <ComfortDashboard />

      {/* 出典表示（ライセンス遵守・全画面で担保） */}
      <footer className="mt-4 border-t border-gray-200 pt-4 text-[11px] leading-relaxed text-gray-500">
        <p>本アプリは公共交通オープンデータセンターのデータを利用しています</p>
        <p>
          混雑率の推定は国土交通省 都市鉄道混雑率調査（都市鉄道の混雑率調査結果）を基礎データとして用いています
        </p>
        <p>
          リアルタイム運行情報にはデータ生成時刻（dc:date）を表示しています
          静的データの取得日時・出典は各データの提供元に従います
        </p>
      </footer>
    </main>
  );
}
