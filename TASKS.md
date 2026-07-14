# TASKS.md — 実装マイルストーン

上から順に進める。各項目は「受け入れ基準（AC）」を満たしたらチェックし、コミットする。
不明点があれば `CLAUDE.md` と `docs/CONCEPT.md` を参照。仕様に迷ったら勝手に広げず、MVPの完了条件（CLAUDE.md）に沿う。

> **Current: M1** ← 今ここ

---

## M0. プロジェクト初期化
- [x] Next.js（App Router）+ TypeScript(strict) + Tailwind をセットアップ
- [x] `@supabase/supabase-js` / `@supabase/ssr` 導入、`lib/supabase/` にクライアント作成
- [x] `.env.example` を複製して `.env.local` を用意（値は仮でよい）
- [x] `pnpm lint` / `pnpm build` が通る（npm 使用）
- **AC**: トップページが起動し、Supabase クライアントが env から初期化される。

## M1. データモデル構築 ← ⛔ ODPTキー + Supabaseプロジェクトの設定待ち (スクリプトは準備済)
- [x] `supabase/schema.sql` を Supabase に適用（migrations 化）※適用実行は Supabase 作成後
- [ ] 対象路線を決めて `railways` / `stations` / `segments` にシード投入
      → `npm run seed:master` 準備済（山手・中央快速・東西）。キー設定後に実行
- [ ] 駅座標・駅順は ODPT `odpt:Station` / `odpt:Railway` から取得して投入（同上）
- **AC**: DB に対象路線の駅・区間が入り、Supabase から取得できる。

## M2. ODPT リアルタイム連携
- [x] `lib/odpt/` に fetch クライアント（型定義 + `consumerKey` はサーバ側）
- [x] `app/api/train-information/route.ts` を作成：`odpt:TrainInformation` を叩き、30–60秒キャッシュ、`dc:date` を含めて返す（キー未設定時はモックにフォールバック）
- [ ] 対象路線の遅延・運休を取得して表示できる ※実データ確認はキー設定後
- **AC**: 現在の運行情報がUIに出て、データ生成時刻(`dc:date`)と出典表示が付く。

## M3. 混雑推定モデル ✅ (投入実行のみSupabase待ち)
- [x] 国交省 混雑率PDF（最新年度・対象路線分）を `data/` に配置（令和6年度 資料2・3）
- [x] `scripts/import-congestion.ts`：PDFから構造化した `supabase/seed/congestion_baseline_2024.csv` を投入（実行はSupabase作成後）
- [x] `odpt:StationTimetable` から時間帯別本数を集計し `timeband_factor` に投入するスクリプト（`npm run seed:timeband`、実行はキー設定後）
- [x] `lib/congestion/estimate.ts` に純関数で推定ロジックを実装（+ 単体テスト27件）
      `推定 = ベース混雑率 × 時間帯係数 × 曜日係数 × リアルタイム補正`
- **AC**: 区間・時刻・曜日・遅延を渡すと 0–1 の推定値と5段階レベルが返り、テストが通る。✅

## M4. 可視化UI（MVPの核）— モックデータで一通り動作、実データ差し替え待ち
- [x] 区間×時間帯の推定混雑を色で表示（一覧 or 簡易路線図）※現状モックデータ
- [x] 「今」の推定＋リアルタイム補正を反映（運行情報バナー + 今の時間帯ハイライト）
- [x] 「この区間、空いているのは何時か」の時間帯ビュー/提案を1つ（バーチャート + トップ3提案）
- [x] 「推定です」注記・出典・`dc:date` を全画面で担保
- [ ] モックデータを実データ（Supabase + estimate.ts）に差し替え ← 次の実装タスク
- **AC**: CLAUDE.md の Definition of Done（可視化・提案・注記）を満たす。

## M5. デプロイ
- [ ] Vercel にデプロイ、env 設定、公開URLで動作確認
- [ ] （任意）Cloudflare 特典環境での公開検討
- **AC**: 公開URLでデモが完結する。

---

## 以降（提出後 / 余裕があれば）— MVPでは着手しない
- Phase 1: 地図(MapLibre等)へのヒートマップ重畳、出発→目的地の空き時間提案
- Phase 2: ユーザー投稿型の混雑報告で推定を補正 / 暑さデータと掛けた「空いて涼しい移動」
- 混雑推定の機械学習化、対象路線の拡大

---

## ハッカソン提出物メモ（開発と並行して埋める）
- [ ] 使用オープンデータ一覧（代表10件）：ODPT 運行情報・駅時刻表・駅情報・路線情報／国交省 混雑率／駅別乗降人員
- [ ] 2分プレゼン動画の構成（課題→"実測が無いから推定する"新規性→デモ→インパクト）
- [ ] エントリー各300字（課題背景・技術詳細・データ活用状況）
