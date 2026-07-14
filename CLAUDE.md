# CLAUDE.md

Claude Code はこのプロジェクトで作業する前に、このファイルと `docs/CONCEPT.md`・`TASKS.md` を必ず読むこと。

## プロジェクト概要
東京の電車の混雑を「統計 × 時刻表」で時間帯別に**推定**し、リアルタイムの運行情報（遅延）で**補正**して可視化する Web アプリ。さらに「空いている時間・区間」を提案し、オフピーク移動＝手取り時間の増加を後押しする。
都知事杯オープンデータ・ハッカソン2026 の個人参加作品。詳しい背景・データ根拠は `docs/CONCEPT.md`。

## ⚠️ 絶対に守る前提（作業の指針）
1. **リアルタイムの車両別・列車別の"実測"混雑度は、東京の電車ではオープンデータに存在しない。** 探しに行かないこと。
   - 東京メトロ・都営の ODPT リアルタイムは「運行情報（遅延・運休）」と GTFS-RT の「Alert」のみ。混雑は無い。
   - JR 東日本の GTFS-RT に occupancy は含まれない。
2. よって本アプリは **「推定（予測）＋リアルタイム補正」** で作る。UI では常に **「これは実測ではなく推定です」** と明示する。
3. **オープンデータのライセンス遵守を実装に必ず含める：**
   - リアルタイムデータには**データ生成時刻 `dc:date` を画面表示**する。
   - **「本アプリは公共交通オープンデータセンターのデータを利用しています」等の出典表示**を入れる。
   - 静的データ（時刻表・駅情報・混雑率・乗降人員）は DB キャッシュ可。取得日時・出典を保持する。
4. **`consumerKey`（ODPT アクセストークン）などのシークレットをクライアントに絶対に出さない。** 必ず環境変数 + サーバ側（Route Handler / Server Component / Edge Function）経由で扱う。
5. **MVP のスコープを勝手に広げない。** 対象は2〜3路線。混雑推定は機械学習ではなくルールベース。非ゴールは `docs/CONCEPT.md` の 5. 参照。

## 技術スタック
- **フロント/サーバ**: Next.js（App Router）+ TypeScript（strict）
- **スタイル**: Tailwind CSS
- **DB**: Supabase（Postgres）。クライアントは `@supabase/supabase-js` / `@supabase/ssr`。
- **ホスティング**: Vercel（デモ公開先として Cloudflare 特典環境も選択可）
- **バッチ/自動化**: GitHub Actions（静的データの取り込み・更新）
- **外部データ**: ODPT（`https://api.odpt.org/api/v4/`）/ 国交省 混雑率 / 駅別乗降人員

## リポジトリ構成（目標）
```
app/                      # Next.js App Router
  (routes)/
  api/                    # Route Handlers（ODPTプロキシ等。keyはここで隠す）
components/               # UIコンポーネント
lib/
  odpt/                   # ODPTクライアント（fetch + 型 + キャッシュ）
  congestion/             # 混雑推定モデル（純関数で書く。テスト可能に）
  supabase/               # Supabaseクライアント
scripts/                  # データ取り込みスクリプト（PDFパース等）
supabase/
  schema.sql              # DDL（このリポジトリに既にある）
  migrations/             # 以降のマイグレーション
data/                     # 手動DLした元データ（混雑率PDF等）。.gitignore対象
docs/
  CONCEPT.md              # 構想・設計の一次資料
```

## データモデル
`supabase/schema.sql` を正とする。主要テーブル：
- `railways` 路線マスタ / `stations` 駅マスタ（座標・乗降人員weight）/ `segments` 駅間区間
- `congestion_baseline` 国交省の区間別混雑率 / `timeband_factor` 時刻表由来の時間帯係数
- `user_reports`（Phase2 のユーザー投稿。MVPでは未使用でよいがスキーマは用意済み）

## 混雑推定モデル（`lib/congestion/`）
```
推定混雑指数 = ベース混雑率(区間)
             × 時間帯係数(路線, 時, 曜日種別)
             × リアルタイム補正(遅延分)
```
- 出力を 0–1 に正規化し、5段階（快適/やや混雑/混雑/かなり混雑/激しい混雑）にマッピング。
- **推定ロジックは副作用のない純関数**で実装し、単体テストを付ける（入力＝マスタ値＋現在時刻＋遅延、出力＝指数）。

## ODPT 連携ルール（`lib/odpt/` + `app/api/`）
- ベース URL: `https://api.odpt.org/api/v4/`、全リクエストに `?acl:consumerKey=${process.env.ODPT_CONSUMER_KEY}`。
- 主に使う: `odpt:TrainInformation`（運行情報/RT）, `odpt:StationTimetable`・`odpt:TrainTimetable`（時刻表/静的）, `odpt:Station`・`odpt:Railway`（マスタ/静的）, 任意で `odpt:Train`（在線位置/RT）。
- 事業者コード: `odpt.Operator:TokyoMetro` / `odpt.Operator:Toei` / `odpt.Operator:JR-East`。
- **リアルタイム取得は Route Handler 経由**にし、レスポンスを 30〜60 秒キャッシュ（`revalidate` or 明示キャッシュ）して API 負荷を抑える。取得した `dc:date` を UI に渡す。
- 静的データは scripts でバッチ取得し Supabase に保存。実行時に毎回叩かない。

## コーディング規約
- TypeScript strict。`any` は原則禁止。外部APIレスポンスは型を定義してからパースする（zod 等で検証してもよい）。
- シークレットはコードに直書きしない。`.env.local`（`.env.example` を複製）。
- 小さく作って動かす。**まずモックデータで UI を通し**、次に実データへ差し替える。
- コミットはこまめに。作業単位ごとに `pnpm lint` / `pnpm build`（または npm）が通ることを確認してから進める。
- 破壊的・不可逆な操作（本番デプロイ、DBの破棄など）は勝手に実行しない。

## MVP の完了条件（Definition of Done）
- [ ] 対象2〜3路線について、区間×時間帯の**推定混雑が色で表示**される。
- [ ] リアルタイム運行情報（遅延）が反映され、`dc:date` と出典が画面に出る。
- [ ] 「この区間、空いているのは何時か」を示す**時間帯別ビュー or 提案**が1つある。
- [ ] 「推定です」の注記とデータ出典表示が全画面で担保されている。
- [ ] Vercel でデプロイでき、公開 URL でデモできる。

## 進め方
`TASKS.md` のマイルストーンを上から順に進める。現在地は `TASKS.md` の "Current" マーカーを見る。各マイルストーン完了時に該当チェックを埋め、コミットする。
