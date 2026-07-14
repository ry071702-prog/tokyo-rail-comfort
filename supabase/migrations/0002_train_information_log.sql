-- 運行情報（遅延・運休）の履歴ログ
-- 用途: リアルタイムの実測混雑がオープンデータに存在しないため、遅延履歴を蓄積し
--       Phase2 で推定補正（遅延補正係数）の較正用データとして使う。
-- ライセンス: 公共交通オープンデータセンターのデータ。出典表示が必要。
--   データ生成時刻 dc:date を dc_date として必ず保持する（ライセンス要件）。
-- 収集: GitHub Actions cron が odpt:TrainInformation を定期取得し upsert する。

create table if not exists train_information_log (
  id          bigint generated always as identity primary key,
  operator    text not null,                 -- 例: odpt.Operator:JR-East
  railway     text,                           -- 例: odpt.Railway:JR-East.Yamanote（路線不明の事業者全体情報は null）
  status_ja   text,                           -- odpt:trainInformationStatus.ja（平常時は無いことが多い）
  text_ja     text,                           -- odpt:trainInformationText.ja（運行状況の本文）
  dc_date     timestamptz not null,           -- dc:date（データ生成時刻。ライセンス要件で保持）
  fetched_at  timestamptz not null default now() -- 収集ジョブが取得した時刻
);

-- 重複防止: 同一 (事業者, 路線, データ生成時刻) は 1 行のみ。
-- railway は nullable のため coalesce で空文字に寄せて一意判定する。
create unique index if not exists uq_train_info_log_dedup
  on train_information_log (operator, coalesce(railway, ''), dc_date);

-- 路線別の時系列参照用（最新から辿る）
create index if not exists idx_train_info_log_railway_date
  on train_information_log (railway, dc_date desc);
