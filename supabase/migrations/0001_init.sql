-- 東京レイルコンフォート（仮）DB スキーマ / Supabase (Postgres)
-- 混雑は「実測」ではなく「推定」。ベース混雑率(国交省) × 時間帯係数(時刻表) × 遅延補正 で算出する。
-- 詳細は docs/CONCEPT.md、運用ルールは CLAUDE.md を参照。

-- 曜日種別
do $$ begin
  create type day_type as enum ('weekday', 'holiday');
exception when duplicate_object then null; end $$;

-- 進行方向（区間の向き。片方向のみ扱う場合も想定して nullable）
do $$ begin
  create type direction as enum ('inbound', 'outbound', 'both');
exception when duplicate_object then null; end $$;

-- 路線マスタ
create table if not exists railways (
  id            text primary key,              -- ODPT の路線ID等（例: odpt.Railway:JR-East.Yamanote）
  operator      text not null,                 -- 例: odpt.Operator:JR-East
  name_ja       text not null,
  name_en       text,
  color         text,                          -- 路線カラー（#RRGGBB）
  order_index   int  not null default 0,
  created_at    timestamptz not null default now()
);

-- 駅マスタ
create table if not exists stations (
  id               text primary key,           -- ODPT の駅ID（例: odpt.Station:JR-East.Yamanote.Tokyo）
  railway_id       text not null references railways(id) on delete cascade,
  name_ja          text not null,
  name_en          text,
  lat              double precision,
  lng              double precision,
  order_index      int not null,               -- 路線内の駅順
  daily_passengers int,                         -- 1日平均乗降人員（駅別乗降人員データ）
  weight           double precision default 1.0,-- 推定按分用の重み（乗降人員から算出）
  created_at       timestamptz not null default now()
);
create index if not exists idx_stations_railway on stations(railway_id, order_index);

-- 区間（駅間）マスタ
create table if not exists segments (
  id             bigint generated always as identity primary key,
  railway_id     text not null references railways(id) on delete cascade,
  from_station_id text not null references stations(id),
  to_station_id   text not null references stations(id),
  order_index    int not null,
  created_at     timestamptz not null default now(),
  unique (railway_id, from_station_id, to_station_id)
);
create index if not exists idx_segments_railway on segments(railway_id, order_index);

-- 混雑ベースライン（国交省 都市鉄道混雑率調査）
-- 最混雑時間帯1時間の平均。年1回・区間単位・ピーク時の統計値。
create table if not exists congestion_baseline (
  id               bigint generated always as identity primary key,
  segment_id       bigint references segments(id) on delete set null,
  railway_id       text references railways(id) on delete cascade, -- 区間対応が取れない場合の path
  segment_label    text,                        -- 元データの区間表記（例: 上野→御徒町）
  dir              direction default 'both',
  peak_time_band   text,                        -- 例: 7:30-8:30
  capacity         int,                         -- 輸送力（人）
  ridership        int,                         -- 輸送人員（人）
  congestion_rate  numeric(5,1) not null,       -- 混雑率(%)（例: 139.0）
  fiscal_year      int not null,                -- 実績年度（西暦）
  source_url       text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_baseline_segment on congestion_baseline(segment_id);
create index if not exists idx_baseline_railway_year on congestion_baseline(railway_id, fiscal_year);

-- 時間帯係数（ODPT 時刻表から集計。本数 → 輸送力の時間帯配分の代理指標）
create table if not exists timeband_factor (
  id           bigint generated always as identity primary key,
  railway_id   text not null references railways(id) on delete cascade,
  dir          direction default 'both',
  day_kind     day_type not null,
  hour         int not null check (hour between 0 and 23),
  train_count  int,                             -- その時間帯の本数
  factor       numeric(4,3) not null default 1.0, -- ピーク=1.0 に対する相対係数
  created_at   timestamptz not null default now(),
  unique (railway_id, dir, day_kind, hour)
);
create index if not exists idx_timeband_railway on timeband_factor(railway_id, day_kind, hour);

-- （Phase2）ユーザー投稿の混雑報告。MVPでは未使用。
create table if not exists user_reports (
  id           bigint generated always as identity primary key,
  segment_id   bigint references segments(id) on delete cascade,
  reported_at  timestamptz not null default now(),
  level        int check (level between 1 and 5), -- 1:快適 〜 5:激混み
  source       text default 'user',
  lat          double precision,
  lng          double precision
);
create index if not exists idx_reports_segment_time on user_reports(segment_id, reported_at desc);

-- メモ: 推定混雑指数は lib/congestion/ の純関数で計算する（DBには推定結果を持たせない）。
--   推定 = (congestion_baseline.congestion_rate / 基準%) × timeband_factor.factor × 遅延補正
