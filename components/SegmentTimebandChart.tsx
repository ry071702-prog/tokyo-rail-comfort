// 選択区間の時間帯別 推定混雑グラフ ＋「空いている時間トップ3」提案。
// 「この区間、空いているのは何時か」に答えるビュー。
"use client";

import type {
  EstimatedLine,
  EstimatedSegment,
} from "@/lib/data/estimate-lines";
import { topComfortableHours } from "@/lib/data/estimate-lines";
import { rateInfo } from "@/lib/mock/congestion";

const SCALE_MAX = 210; // バー高さの上限スケール(%)

export function SegmentTimebandChart({
  line,
  segment,
  currentHour,
}: {
  line: EstimatedLine;
  segment: EstimatedSegment;
  currentHour: number | null;
}) {
  const best = topComfortableHours(segment, 3);
  const nowRate = currentHour !== null ? segment.hourly[currentHour] : null;
  const nowInfo = nowRate !== null ? rateInfo(nowRate) : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-bold text-gray-900">
          {segment.fromStation}→{segment.toStation}
        </h2>
        <span
          className="rounded px-2 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: line.color }}
        >
          {line.name}
        </span>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        時間帯別の推定混雑（この区間で空いている時間を探せます）
      </p>

      {nowInfo && currentHour !== null && (
        <p className="mb-3 text-sm text-gray-700">
          今（{currentHour}時台）の推定:{" "}
          <span
            className="rounded px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: nowInfo.fill, color: nowInfo.onFill }}
          >
            {nowInfo.label}・約{nowRate}%
          </span>
        </p>
      )}

      {/* 時間帯別バー */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[560px] gap-1" style={{ height: 140 }}>
          {segment.hourly.map((rate, h) => {
            const info = rateInfo(rate);
            const heightPct = Math.min(100, (rate / SCALE_MAX) * 100);
            const isNow = h === currentHour;
            return (
              <div
                key={h}
                className="flex h-full flex-1 flex-col items-center justify-end"
                title={`${h}時台 推定混雑率${rate}%（${info.label}）`}
              >
                <span className="mb-0.5 text-[9px] text-gray-400">{rate}</span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: info.fill,
                    outline: isNow ? "2px solid #111827" : undefined,
                    outlineOffset: isNow ? "-2px" : undefined,
                  }}
                />
                <span
                  className={`mt-1 text-[9px] ${
                    isNow ? "font-bold text-gray-900" : "text-gray-400"
                  }`}
                >
                  {h}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 空いている時間トップ3 */}
      <div className="mt-4 rounded-md bg-gray-50 p-3">
        <h3 className="mb-2 text-sm font-bold text-gray-900">
          この区間、空いているのは何時か
        </h3>
        <ol className="flex flex-wrap gap-2">
          {best.map((b, i) => {
            const info = rateInfo(b.rate);
            return (
              <li
                key={b.hour}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
              >
                <span className="text-xs font-bold text-gray-400">
                  #{i + 1}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {b.hour}時台
                </span>
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: info.fill, color: info.onFill }}
                >
                  {info.label}・約{b.rate}%
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[11px] text-gray-400">
          始発以降（5〜23時）の推定値から空いている順に提案しています
        </p>
      </div>
    </div>
  );
}
