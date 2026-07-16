# 参加者特典の活用検討 — Cloudflare / OpenCode

7/16 公開の特典マニュアル2本を読んでの検討メモ  申請はチーム単位 (1名でも「1名チーム」) で本人が行う

## 結論 (先に)

- **デプロイ先を Vercel → Cloudflare に寄せる価値は高い**  特に **D1 (SQLite) が Supabase を完全に代替できる** ため、**本人の Supabase 作成作業がまるごと不要になる**
- ただし **提出直前の移行は禁物** (URL が壊れるリスク)  まず Vercel で公開URLを確保 → 特典が通ったら Cloudflare に移す、の順が安全
- **利用期間は 2026年9月末まで** (ファイナリストは延長)  → **期間終了前に D1/R2 のデータエクスポートと GitHub バックアップが必須** (権限停止後アクセス不可)

## Cloudflare Paid 特典で使えるもの (この作品に効くもの)

| サービス | この作品での使い道 |
|---|---|
| **D1** (SQLite) | **Supabase の代替**  railways/stations/segments/congestion_baseline/timeband_factor/train_information_log をそのまま持てる  Workers から SQL 実行 |
| **Pages / Workers** | Next.js のデプロイ先 (マニュアルは新規は Workers 推奨) |
| **Workers AI** | Phase2 で「遅延テキストの分類」等に使えるが MVP では不要 |
| R2 / KV / Vectorize 等 | 現構成では不要 |

- 申請フロー: Cloudflareアカウント作成 → Googleフォームでメール申請 → 事務局がチーム作成 → 招待承認 → 利用開始
- **禁止事項の要点**: 成果物開発以外の利用禁止 / 認証情報をコードに直書き禁止・公開リポジトリに含めない (本作品は既に遵守: `.env.local` 未追跡・キーは環境変数) / Secrets Store か環境変数で管理

## D1 に寄せる場合の移行方針 (やるなら)

現状は `@supabase/supabase-js` で Postgres を叩く前提  D1 は SQLite で API も別物なので、以下の対応が要る (中規模の作業):

1. **スキーマの SQLite 化**: `supabase/schema.sql` は Postgres 方言 (`generated always as identity` / `timestamptz` / `do $$ ... enum`)  → D1 用に `INTEGER PRIMARY KEY AUTOINCREMENT` / `TEXT` (ISO日時) / enumはCHECK制約 に書き換えた `d1/schema.sql` を別途用意
2. **データアクセス層の抽象化**: 今は UI が `lib/data/baseline.ts` のミラーで動くので**読み取りは影響なし**  DB を使うのは seed スクリプトと遅延収集のみ  → これらを D1 の `wrangler d1 execute` / Workers バインディング経由に書き換える
3. **Next.js on Workers**: `@opennextjs/cloudflare` アダプタが要る  Route Handler のキャッシュ (`s-maxage`) は Cloudflare の設定に読み替え
4. **遅延収集**: GitHub Actions cron のままでも良いし、**Cloudflare Cron Triggers + Workers** に寄せれば完全に Cloudflare 内で完結する

### 判断の目安

- **時間が無ければ**: Vercel + Supabase のまま提出  今すぐ動く  特典は使わなくても減点ではない
- **特典を活かすなら**: Pages に Next.js を載せる (D1 は後回しでも可)  → まず「Vercel と同じ構成を Cloudflare Pages で公開」だけでも特典利用の実績になる
- **フルに寄せるなら**: D1 移行まで  Supabase 不要になり本人作業が減る  ただし OpenNext の運用コスト (キャッシュ・Route Handler の挙動差) を検証する時間が要る

## OpenCode + Workers AI 特典

- **OpenCode**: CLIで動く生成AI開発ツール (VS Code連携可)  この作品の開発補助に使える (コード生成・レビュー・ドキュメント)
- **モデル**: Qwen3 30B FP8 (推奨・低コスト) / Qwen2.5 Coder 32B (コード特化だが入力コスト約10倍) / GPT-OSS 20B (128kトークンで大きいファイル向き)
- **クレジット**: チーム$100 (超過はSlackで増額申請)  期限 9月末
- 申請は Slack登録済みメールで Googleフォーム経由
- **この作品での位置づけ**: 開発補助ツール  必須ではないが、無料で使えるので申請しておいて損はない  ただし機密情報・認証情報の入力は禁止

## 次アクション (本人)

1. Cloudflareアカウント作成 + Googleフォームで特典申請 (Paid と OpenCode 両方  1名チームで)
2. まずは Vercel で公開URL確保 (README のボタン)  → 特典が通ってから Cloudflare Pages 公開を試す
3. D1 移行は「時間と余裕があれば」  MVP はどちらの構成でも成立する
