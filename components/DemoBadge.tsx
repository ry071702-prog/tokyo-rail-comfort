// モック由来の値であることを示す小さなバッジ。実データ差し替え前の目印。
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ${className}`}
    >
      デモデータ
    </span>
  );
}
