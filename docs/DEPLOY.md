# デプロイ手順 (Vercel)

このアプリは **ODPT キーも Supabase も未設定のまま本番デプロイできる** (運行情報はモックにフォールバックし、混雑推定は国交省 CSV をミラーした `lib/data/baseline.ts` で動く)

なので進め方は **「まずデプロイして公開 URL を取る」→「あとからキーを差す」** を推奨する  ハッカソンの提出物・審査は公開 URL が起点になるので、URL の確定を先に済ませておくと安全

---

## 0. 前提

- Next.js 標準構成なので **`vercel.json` は不要** (ビルドコマンド・出力先は Vercel が自動検出する)
- Node.js は 22 系を想定 (GitHub Actions と揃える)

## 1. Vercel にインポート

1. https://vercel.com/new で GitHub リポジトリ `tokyo-rail-comfort` を Import
2. Framework Preset: **Next.js** (自動検出される)
3. Build Command / Output Directory / Install Command: **すべて既定のまま** (`next build` / `.next` / `npm install`)
4. 環境変数を入れずに **Deploy** → この時点で公開 URL が取れる (運行情報は「デモデータ」バッジ付きのモック表示)

## 2. 環境変数の設定

Vercel の **Project Settings → Environment Variables** で設定する  Production / Preview / Development の3環境に入れる

| 変数名 | 値 | 公開範囲 | 未設定時の挙動 |
|---|---|---|---|
| `ODPT_CONSUMER_KEY` | ODPT の consumerKey | **サーバ専用** | 運行情報がモックになる (アプリは動く) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | クライアントに露出 (前提) | DB 参照なしで動く |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の anon key | クライアントに露出 (前提) | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase の service_role key | **サーバ専用** | seed / 収集スクリプトが動かない |

### ⚠️ `ODPT_CONSUMER_KEY` に `NEXT_PUBLIC_` を絶対に付けない

`NEXT_PUBLIC_` を付けた環境変数は **ビルド時にクライアント JS へ埋め込まれ、ブラウザから誰でも読める**  ODPT の consumerKey が漏れるとキーの悪用・失効につながる  この鍵はサーバ側 (`app/api/train-information/route.ts` → `lib/odpt/client.ts` と `scripts/`) でのみ読む

- ✅ `ODPT_CONSUMER_KEY`
- ❌ `NEXT_PUBLIC_ODPT_CONSUMER_KEY`

`SUPABASE_SERVICE_ROLE_KEY` も同様に RLS を素通りする強い鍵なので、クライアントに出さない (Vercel のランタイムと GitHub Actions Secrets でのみ使う)

環境変数を追加・変更したら **Redeploy が必要** (既存のデプロイには反映されない)

## 3. 動作確認

公開 URL を開いて以下を確認する

- [ ] 区間 × 時間帯の推定混雑が色で表示される
- [ ] 運行情報バナーにデータ生成時刻 (`dc:date`) と出典が出る
- [ ] キー設定後は「デモデータ」バッジが消える (= `mock: false`)
- [ ] `/api/train-information` を直接叩き、`mock` / `fetchedAt` / `attribution` が返る
- [ ] クライアント JS に consumerKey が含まれない (ブラウザの DevTools → Sources で検索して確認)

### 運行情報 API のキャッシュについて

`app/api/train-information/route.ts` は `dynamic = "force-dynamic"` を宣言している  これはビルド時のプリレンダリング (レスポンスの焼き込み) を防ぐためで、**キーの有無の判定と `dc:date` を必ずリクエスト時に評価させる**のが目的

代わりに ODPT への実リクエストは
- `fetch` のデータキャッシュ (`next: { revalidate: 45 }`)
- レスポンスの `Cache-Control: s-maxage=45, stale-while-revalidate=30` (Vercel の CDN が保持)

の 2 段で **45 秒に 1 回**へ抑えている  ODPT への負荷を上げないため、この値を短くしないこと

## 4. 静的データの投入 (任意 / Supabase を使う場合)

```bash
npm run seed:master      # ① ODPT → railways / stations / segments
npm run seed:congestion  # ② 国交省 CSV → congestion_baseline
npm run seed:timeband    # ③ ODPT 時刻表 → timeband_factor
```

先に Supabase で `supabase/migrations/0001_init.sql` → `0002_train_information_log.sql` を適用しておく  実行はローカル (`.env.local` を読む) で構わない

## 5. 運行情報の定期収集 (任意)

`.github/workflows/collect-train-info.yml` が 10 分ごとに運行情報を Supabase に記録する (Phase2 の推定較正用)  誤作動防止のため既定では動かない

1. GitHub の **Settings → Secrets and variables → Actions → Secrets** に登録
   `ODPT_CONSUMER_KEY` / `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
2. 同画面の **Variables** タブに `COLLECT_ENABLED = true` を登録 (これを立てるまでジョブはスキップされる)
3. Actions タブから `workflow_dispatch` で手動実行し、疎通を確認

---

## Cloudflare 環境 (ハッカソン特典)

都知事杯オープンデータ・ハッカソン2026 の特典として **Cloudflare の Paid プラン相当の公開環境**が提供される (エントリー後に申請  9月末まで利用可)  デモ公開先として Vercel の代わりに選べる

- 申請は **エントリー完了後**  まずは Vercel で公開 URL を確保し、特典が使えるようになってから移行を検討する
- Next.js (App Router) を Cloudflare Workers/Pages に載せる場合は OpenNext (`@opennextjs/cloudflare`) 等のアダプタが必要になる  Route Handler のキャッシュ挙動 (`s-maxage`) も Cloudflare 側の設定に読み替える必要がある
- **移行するとしても提出直前は避ける**  審査で参照される URL が壊れるリスクの方が大きい

---

## トラブルシュート

| 症状 | 原因 / 対処 |
|---|---|
| 運行情報が常に「デモデータ」 | `ODPT_CONSUMER_KEY` が未設定 or 環境変数の追加後に Redeploy していない |
| キーを入れたのに `mock: true` | ODPT のキーが失効/レート制限  Route Handler は fetch 失敗時もモックに落として画面を止めない仕様 (Vercel の Function ログにエラーが出る) |
| ビルドは通るが実データが出ない | Supabase 未設定でも UI は動く設計  推定のベース値は `lib/data/baseline.ts` から読んでいる |
| `dc:date` が古い時刻で固定される | ビルド時プリレンダリングの兆候  `route.ts` の `dynamic = "force-dynamic"` が消えていないか確認する |
