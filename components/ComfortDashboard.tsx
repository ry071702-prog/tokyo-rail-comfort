// トップ画面の中核（クライアント）。路線選択・運行情報取得・区間選択の状態を束ねる。
"use client";

import { useEffect, useMemo, useState } from "react";
import { MOCK_LINES, getLine } from "@/lib/mock/lines";
import type { TrainInfoResponse } from "@/lib/mock/train-information";
import { ServiceStatusBanner } from "@/components/ServiceStatusBanner";
import { CongestionHeatmap } from "@/components/CongestionHeatmap";
import { SegmentTimebandChart } from "@/components/SegmentTimebandChart";
import { CongestionLegend } from "@/components/CongestionLegend";

export function ComfortDashboard() {
  const [lineId, setLineId] = useState<string>(MOCK_LINES[0].id);
  const [segmentId, setSegmentId] = useState<string>(
    MOCK_LINES[0].segments[0].id
  );
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [trainInfo, setTrainInfo] = useState<TrainInfoResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const line = getLine(lineId) ?? MOCK_LINES[0];
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
    const next = getLine(id);
    if (next) setSegmentId(next.segments[0].id);
  };

  const lineButtons = useMemo(
    () =>
      MOCK_LINES.map((l) => {
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
