// 混雑5段階の凡例。色スケール（緑→赤）＋テキストラベルを必ず併記する（色覚多様性への配慮）。
import { CONGESTION_LEVELS } from "@/lib/mock/congestion";

export function CongestionLegend() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-gray-900">
        混雑度の目安（5段階）
      </h3>
      <ul className="flex flex-col gap-2">
        {CONGESTION_LEVELS.map((lv) => (
          <li key={lv.level} className="flex items-center gap-3 text-xs">
            <span
              className="flex h-7 w-16 shrink-0 items-center justify-center rounded font-bold"
              style={{ backgroundColor: lv.fill, color: lv.onFill }}
            >
              {lv.label}
            </span>
            <span className="text-gray-600">{lv.hint}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-gray-400">
        数値は国交省 都市鉄道混雑率調査の体感目安にもとづく推定です
      </p>
    </div>
  );
}
