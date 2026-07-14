# 東京レイルコンフォート (Tokyo Rail Comfort)

**東京の電車の「空いている時間」を、オープンデータから推定して選べるようにする Web アプリ**

都知事杯オープンデータ・ハッカソン2026 個人参加作品

---

## この作品の核心

> **リアルタイムの車両別混雑の「実測」は、東京の電車のオープンデータに存在しない**

東京メトロ・都営の ODPT リアルタイムデータは運行情報 (遅延・運休) と GTFS-RT の Alert のみ  JR東日本の GTFS-RT にも occupancy (混雑) フィールドは入っていない  各社アプリが持つ車両別混雑は非公開

だからこの作品は **実測を諦め、推定する**

```
推定混雑率 = ベース混雑率(国交省 統計) × 時間帯係数(時刻表) × 曜日係数 × 遅延補正(運行情報)
```

国交省の混雑率統計を土台に、時刻表から時間帯のカーブを引き、リアルタイム運行情報の遅延で補正する  「実測が無い」という制約を、**複数のオープンデータの掛け合わせで乗り越える**のが本作品のアプローチであり、UI では常に「これは実測ではなく推定です」と明示する

| これは | これではない |
|---|---|
| 統計 × 時刻表 × 運行情報からの **推定** の可視化 | リアルタイム車両別混雑の **実測** 表示 |
| 「この区間、何時なら空いているか」の提案 | 経路検索・乗換案内 |
| 対象2〜3路線に絞った MVP | 全事業者・全路線の網羅 |

---

## スクリーンショット

<!-- 画像を docs/screenshot.png として配置する -->
![東京レイルコンフォートの画面 (区間×時間帯の推定混雑ヒートマップ + 空き時間提案)](docs/screenshot.png)

*区間 × 時間帯の推定混雑ヒートマップ / 選択区間の時間帯グラフと「空いている時間」トップ3 / リアルタイム運行情報バナー (dc:date 付き)*

---

## 使用しているオープンデータ

| # | データ | 提供元 | 本アプリでの用途 |
|---|---|---|---|
| 1 | 列車運行情報 `odpt:TrainInformation` | [公共交通オープンデータセンター (ODPT)](https://www.odpt.org/) | 遅延・運休のリアルタイム補正 |
| 2 | 駅時刻表 `odpt:StationTimetable` | ODPT | 時間帯別本数 → 時間帯係数の算出 |
| 3 | 列車時刻表 `odpt:TrainTimetable` | ODPT | 時間帯係数の補完 |
| 4 | 駅情報 `odpt:Station` | ODPT | 駅マスタ (座標・駅順) |
| 5 | 路線情報 `odpt:Railway` | ODPT | 路線マスタ・駅順 |
| 6 | 列車在線位置 `odpt:Train` | ODPT | 運行乱れの検知 (拡張) |
| 7 | [都市鉄道の混雑率調査 (令和6年度実績)](https://www.mlit.go.jp/report/press/tetsudo04_hh_000138.html) | 国土交通省 | **区間別ベース混雑率** (推定の土台) |
| 8 | 駅別乗降人員 | [東京都オープンデータカタログ](https://portal.data.metro.tokyo.lg.jp/) / 各鉄道事業者 | 駅重みの按分 |

国交省 混雑率調査の一次資料 (PDF): [資料2](https://www.mlit.go.jp/report/press/content/001904497.pdf) / [資料3](https://www.mlit.go.jp/report/press/content/001902900.pdf)
そこから構造化した CSV: [`supabase/seed/congestion_baseline_2024.csv`](supabase/seed/congestion_baseline_2024.csv)

- API ベース URL: `https://api.odpt.org/api/v4/`
- 対象事業者: `odpt.Operator:JR-East` / `odpt.Operator:TokyoMetro`
- 対象路線 (MVP): JR山手線 / JR中央快速線 / 東京メトロ東西線

---

## 推定モデル

実装: [`lib/congestion/estimate.ts`](lib/congestion/estimate.ts) (副作用のない純関数 + 単体テスト)
路線データへの結線: [`lib/data/estimate-lines.ts`](lib/data/estimate-lines.ts) / ベース値: [`lib/data/baseline.ts`](lib/data/baseline.ts)

```
推定混雑率(%) = ベース混雑率(区間) × 時間帯係数(時) × 曜日係数(平日/土休日) × 遅延補正(分)
```

| 項 | 出どころ | 現状 |
|---|---|---|
| ベース混雑率 | 国交省 令和6年度 混雑率調査の路線最大値 | **実データ** |
| 区間ウェイト | 区間ごとの相対差の按分 | **暫定** (ODPT 駅データ・乗降人員で置換予定) |
| 時間帯係数 | 通勤需要カーブの近似 | **暫定** (ODPT 駅時刻表由来の `timeband_factor` で置換予定  `npm run seed:timeband`) |
| 曜日係数 | 平日 1.0 / 土休日 0.7 | 経験則 |
| 遅延補正 | 運行情報の遅延分 × +2%/分 (上限 +50%) | ルールベース |

### レベル境界の根拠

国交省の混雑率の目安 (定員乗車 = 100%) に合わせて 5 段階にマッピングしている

| 推定混雑率 | レベル | 国交省の目安 |
|---|---|---|
| 〜100% | 快適 | 定員乗車 (座席・つり革・手すりが埋まる) |
| 100〜150% | やや混雑 | 新聞が楽に読める |
| 150〜180% | 混雑 | 肩が触れ合う (新聞は折れば読める) |
| 180〜200% | かなり混雑 | 体が触れ合うが週刊誌なら読める |
| 200%〜 | 激しい混雑 | 体が触れ合い相当の圧迫感 |

0–1 の指数には「混雑率 200% = 1.0」で正規化する

---

## オープンデータのライセンス遵守

- **データ生成時刻 (`dc:date`) を画面に表示**する (リアルタイム運行情報)
- **出典表示**: 「本アプリは公共交通オープンデータセンターのデータを利用しています」を全画面のフッタに常時表示
- **「実測ではなく推定です」の注記**を全画面に常時表示 (ヘッダの警告ブロック)
- 静的データ (混雑率・時刻表・駅情報) は出典 URL・調査年度を保持したまま DB / コードにキャッシュする
- ODPT の `consumerKey` はサーバ側 (Route Handler / scripts) でのみ使用し、クライアントには一切露出させない (`NEXT_PUBLIC_` を付けない)

---

## セットアップ

### 1. 依存のインストール

```bash
npm install
cp .env.example .env.local
npm run dev          # → http://localhost:3000
```

**キーが未設定でもそのまま動く**  ODPT キーが無い場合、運行情報 API はモックデータにフォールバックし (`mock: true`)、画面には「デモデータ」バッジが出る  混雑推定は国交省 CSV をミラーした `lib/data/baseline.ts` を使うため、DB なしでも実データで動く

### 2. 実データ連携 (任意)

| 環境変数 | 用途 | 必須か |
|---|---|---|
| `ODPT_CONSUMER_KEY` | ODPT のリアルタイム運行情報・時刻表 (**サーバ専用**) | 無ければモック |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | DB 投入時 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公開キー | DB 投入時 |
| `SUPABASE_SERVICE_ROLE_KEY` | seed / 収集スクリプト用 (**サーバ専用**) | DB 投入時 |

1. [developer.odpt.org](https://developer.odpt.org/) で無料登録し `consumerKey` を取得 → `.env.local` へ
2. Supabase プロジェクトを作成し、`supabase/migrations/` を適用 (`0001_init.sql` → `0002_train_information_log.sql`)
3. seed を **この順で** 実行する

```bash
npm run seed:master      # ① ODPT から路線・駅・区間マスタを投入 (要 ODPT キー)
npm run seed:congestion  # ② 国交省 混雑率 CSV を congestion_baseline へ投入
npm run seed:timeband    # ③ ODPT 駅時刻表から時間帯係数を算出し timeband_factor へ投入
```

`seed:master` が先  `seed:congestion` と `seed:timeband` はマスタの路線・区間を参照する

### 3. デプロイ

[`docs/DEPLOY.md`](docs/DEPLOY.md) を参照  キー未設定でもモックで動くので、**先にデプロイして公開 URL を取ってから**実データを差していける

---

## 開発コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ (http://localhost:3000) |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm test` | 単体テスト (Vitest  推定エンジンの純関数テスト) |
| `npm run seed:master` | ODPT → `railways` / `stations` / `segments` |
| `npm run seed:congestion` | 国交省 CSV → `congestion_baseline` |
| `npm run seed:timeband` | ODPT 時刻表 → `timeband_factor` |
| `npm run collect:train-info` | 運行情報を Supabase に記録 (GitHub Actions から 10 分ごと  `COLLECT_ENABLED=true` で有効化) |

型チェックは `npx tsc --noEmit`

---

## ディレクトリ構成

```
app/
  page.tsx                       # トップ (推定の注記・出典表示を担保)
  api/train-information/route.ts # ODPT 運行情報プロキシ (consumerKey を隠す / キー未設定はモック)
components/
  ComfortDashboard.tsx           # 画面の中核 (路線選択・運行情報・区間選択)
  CongestionHeatmap.tsx          # 区間 × 時間帯ヒートマップ
  SegmentTimebandChart.tsx       # 選択区間の時間帯グラフ + 空き時間トップ3
  ServiceStatusBanner.tsx        # 運行情報バナー (dc:date 表示)
  CongestionLegend.tsx / DemoBadge.tsx
lib/
  congestion/estimate.ts         # 推定モデル (純関数 + テスト)
  data/baseline.ts               # 国交省 混雑率のミラー (出典 URL 付き)
  data/estimate-lines.ts         # 推定エンジン × 路線データの結線
  data/parse-delay.ts            # 運行情報テキスト → 遅延分数
  odpt/                          # ODPT クライアント (サーバ専用) + 型
  mock/                          # モックデータ (キー未設定時のフォールバック)
  supabase/                      # Supabase クライアント (client / server / admin)
scripts/                         # seed / 収集スクリプト (tsx)
supabase/
  schema.sql / migrations/       # DDL
  seed/congestion_baseline_2024.csv  # 国交省 PDF を構造化した CSV (正本)
docs/
  CONCEPT.md                     # 構想・データ根拠 (一次資料)
  ENTRY.md                       # ハッカソン提出物ドラフト
  DEPLOY.md                      # デプロイ手順
data/                            # 手動DLした元データ (混雑率PDF)  ※gitignore
.github/workflows/               # 運行情報の定期収集 (Phase2 の較正用)
```

設計の前提・作業規約は [`CLAUDE.md`](CLAUDE.md)、実装マイルストーンは [`TASKS.md`](TASKS.md)

---

## 免責

- **本アプリが表示する混雑度は推定値であり、実際の混雑を保証するものではありません**  実測データではなく、統計・時刻表・運行情報から算出した推定です
- 区間ごとの按分と時間帯カーブは現時点で暫定値を含みます (ODPT 時刻表由来の実データで置換していく計画)
- リアルタイム運行情報は ODPT の配信内容に依存します  実際の運行状況は各鉄道事業者の公式情報を確認してください
- 本アプリは公共交通オープンデータセンターのデータを利用していますが、その内容は必ずしも正確でない場合があります  本アプリの表示について、鉄道事業者・公共交通オープンデータ協議会への問い合わせはご遠慮ください

## データ出典

- 公共交通オープンデータセンター (ODPT) — https://www.odpt.org/
- 国土交通省 都市鉄道の混雑率調査 (令和6年度実績) — https://www.mlit.go.jp/report/press/tetsudo04_hh_000138.html
- 東京都オープンデータカタログ — https://portal.data.metro.tokyo.lg.jp/

本アプリは公共交通オープンデータセンターのデータを利用しています
