// トップ画面の中核（クライアント）。路線選択・運行情報取得・区間選択の状態を束ねる。
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ESTIMATED_LINES,
  getEstimatedLine,
  type EstimatedLine,
} from "@/lib/data/estimate-lines";
import { parseDelayMinutes } from "@/lib/data/parse-delay";
import type {
  TrainInfoItem,
  TrainInfoResponse,
} from "@/lib/mock/train-information";
import { ServiceStatusBanner } from "@/components/ServiceStatusBanner";
import { CongestionHeatmap } from "@/components/CongestionHeatmap";
import { SegmentTimebandChart } from "@/components/SegmentTimebandChart";
import { CongestionLegend } from "@/components/CongestionLegend";

// 運行情報アイテムが対象路線のものか（路線名 or 事業者コードで突き合わせ）。
function matchesLine(item: TrainInfoItem, line: EstimatedLine): boolean {
  if (item.railwayLabel && item.railwayLabel === line.name) return true;
  return item.operator === line.operator;
}

export function ComfortDashboard() {
  const [lineId, setLineId] = useState<string>(ESTIMATED_LINES[0].id);
  const [segmentId, setSegmentId] = useState<string>(
    ESTIMATED_LINES[0].segments[0].id
  );
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [trainInfo, setTrainInfo] = useState<TrainInfoResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 選択路線の遅延分数（運行情報の異常アイテムから最大値を採る）。0 なら補正なし。
  const delayMinutes = useMemo(() => {
    if (!trainInfo) return 0;
    const base = ESTIMATED_LINES.find((l) => l.id === lineId);
    if (!base) return 0;
    return trainInfo.items
      .filter((i) => !i.normal && matchesLine(i, base))
      .reduce((max, i) => Math.max(max, parseDelayMinutes(i.text)), 0);
  }, [trainInfo, lineId]);

  // 実データ由来の推定ライン。「今」の時間帯セルにのみ遅延補正を反映する。
  const line = useMemo(
    () =>
      getEstimatedLine(lineId, { nowHour: currentHour, delayMinutes }) ??
      ESTIMATED_LINES[0],
    [lineId, currentHour, delayMinutes]
  );
  const segment =
    line.segments.find((s) => s.id === segmentId) ?? line.segments[0];

  // 「今」の時間帯はクライアントで決める（SSR とのハイドレーション不一致を避ける）
  useEffect(() => {
    const update = () => {
      const jstHour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          hour12: false,
        }).format(new Date())
      );
      setCurrentHour(jstHour % 24);
    };
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // 運行情報を取得（30〜60 秒キャッシュされた Route Handler 経由）
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/train-information", {
          cache: "no-store",
        });
        const json = (await res.json()) as TrainInfoResponse;
        if (active) setTrainInfo(json);
      } catch {
        if (active) setTrainInfo(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const handleSelectLine = (id: string) => {
    setLineId(id);
    const next = ESTIMATED_LINES.find((l) => l.id === id);
    if (next) setSegmentId(next.segments[0].id);
  };

  const lineButtons = useMemo(
    () =>
      ESTIMATED_LINES.map((l) => {
        const active = l.id === lineId;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => handleSelectLine(l.id)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${
              active
                ? "border-transparent text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
            }`}
            style={active ? { backgroundColor: l.color } : undefined}
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: active ? "#ffffff" : l.color }}
            />
            {l.name}
          </button>
        );
      }),
    [lineId]
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 路線選択 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-500">路線を選ぶ</h2>
        <div className="flex flex-wrap gap-2">{lineButtons}</div>
      </section>

      {/* 運行情報バナー（今の遅延状況 + dc:date） */}
      <ServiceStatusBanner data={trainInfo} loading={loading} line={line} />

      {/* 区間 × 時間帯ヒートマップ */}
      <CongestionHeatmap
        line={line}
        currentHour={currentHour}
        selectedSegmentId={segment.id}
        onSelectSegment={setSegmentId}
      />

      {/* 選択区間の時間帯グラフ + 空き時間トップ3 */}
      <SegmentTimebandChart
        line={line}
        segment={segment}
        currentHour={currentHour}
      />

      {/* 凡例 */}
      <CongestionLegend />
    </div>
  );
}
