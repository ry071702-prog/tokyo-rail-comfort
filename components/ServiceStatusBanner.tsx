// 運行情報バナー。リアルタイム運行情報（遅延）の状況と dc:date を表示する。
// モック時は「デモデータ」を明示。ライセンス要件のため出典・データ生成時刻を必ず出す。
"use client";

import type { MockLine } from "@/lib/mock/lines";
import type { TrainInfoItem, TrainInfoResponse } from "@/lib/mock/train-information";
import { DemoBadge } from "@/components/DemoBadge";

function formatJst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function matchesLine(item: TrainInfoItem, line: MockLine): boolean {
  if (item.railwayLabel && item.railwayLabel === line.name) return true;
  return item.operator === line.operator;
}

export function ServiceStatusBanner({
  data,
  loading,
  line,
}: {
  data: TrainInfoResponse | null;
  loading: boolean;
  line: MockLine;
}) {
  if (loading && !data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
        運行情報を取得中…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
        運行情報を取得できませんでした
      </div>
    );
  }

  // 選択中の路線に関係する情報
  const own = data.items.filter((i) => matchesLine(i, line));
  const ownAbnormal = own.filter((i) => !i.normal);
  // 他路線の遅延・運休（参考）
  const otherAbnormal = data.items.filter(
    (i) => !matchesLine(i, line) && !i.normal
  );

  const hasDelay = ownAbnormal.length > 0;
  const boxClass = hasDelay
    ? "border-red-300 bg-red-50"
    : "border-emerald-300 bg-emerald-50";
  const headText = hasDelay ? "text-red-800" : "text-emerald-800";

  return (
    <div className={`rounded-lg border px-4 py-3 ${boxClass}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className={`text-sm font-bold ${headText}`}>
          {line.name} の運行情報
        </span>
        {data.mock && <DemoBadge />}
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${
            hasDelay ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {hasDelay ? "遅延あり" : "平常運転"}
        </span>
      </div>

      {hasDelay ? (
        <ul className="flex flex-col gap-1 text-sm text-red-900">
          {ownAbnormal.map((i) => (
            <li key={i.id}>
              {i.status ? `【${i.status}】` : ""}
              {i.text ?? "詳細情報なし"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-emerald-900">
          現在、選択中の路線は平常どおり運転しています
        </p>
      )}

      {otherAbnormal.length > 0 && (
        <p className="mt-2 text-xs text-gray-600">
          他路線: {otherAbnormal.map((i) => i.railwayLabel ?? i.operatorLabel).join("、")}
          で遅延情報あり
        </p>
      )}

      <p className="mt-2 text-[11px] text-gray-500">
        データ生成時刻（dc:date）: {formatJst(data.fetchedAt)}／{data.attribution}
      </p>
    </div>
  );
}
