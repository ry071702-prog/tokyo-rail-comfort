// 区間 × 時間帯（0〜23時）の推定混雑ヒートマップ。
// 行=区間、列=時。セルは 5 段階の色＋推定混雑率(%) を数値でも表示（色のみに依存しない）。
// 「今」の時間帯の列をハイライトし、行クリックで区間を選択する。
"use client";

import type { EstimatedLine } from "@/lib/data/estimate-lines";
import { rateInfo } from "@/lib/mock/congestion";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function CongestionHeatmap({
  line,
  currentHour,
  selectedSegmentId,
  onSelectSegment,
}: {
  line: EstimatedLine;
  currentHour: number | null;
  selectedSegmentId: string;
  onSelectSegment: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="text-base font-bold text-gray-900">
          区間 × 時間帯の推定混雑
        </h2>
        <p className="text-[11px] text-gray-400">
          数値は国交省統計に基づく推定混雑率(%)／横スクロールで全時間帯
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-bold text-gray-500">
                区間 \ 時
              </th>
              {HOURS.map((h) => (
                <th
                  key={h}
                  className={`min-w-[34px] px-1 py-2 font-bold ${
                    h === currentHour
                      ? "bg-gray-900 text-white"
                      : "text-gray-400"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {line.segments.map((seg) => {
              const selected = seg.id === selectedSegmentId;
              return (
                <tr
                  key={seg.id}
                  onClick={() => onSelectSegment(seg.id)}
                  className={`cursor-pointer ${
                    selected ? "ring-2 ring-inset" : ""
                  }`}
                  style={selected ? { boxShadow: `inset 0 0 0 2px ${line.color}` } : undefined}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left text-xs font-medium text-gray-800"
                  >
                    {seg.fromStation}→{seg.toStation}
                  </th>
                  {seg.hourly.map((rate, h) => {
                    const info = rateInfo(rate);
                    const isNow = h === currentHour;
                    return (
                      <td
                        key={h}
                        title={`${seg.fromStation}→${seg.toStation} ${h}時台 推定混雑率${rate}%（${info.label}）`}
                        className="px-0.5 py-1"
                        style={{
                          backgroundColor: info.fill,
                          color: info.onFill,
                          outline: isNow ? "2px solid #111827" : undefined,
                          outlineOffset: isNow ? "-2px" : undefined,
                        }}
                      >
                        {rate}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-2 text-[11px] text-gray-400">
        黒枠＝「今」の時間帯（遅延補正あり）／行をタップすると下に時間帯グラフを表示します
        区間ごとの差は暫定の按分です
      </p>
    </div>
  );
}
