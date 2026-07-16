import Link from "next/link";
import type { Metadata } from "next";

// この作品の透明性ページ。審査員・都民が「仕組み・使うデータ・推定の限界」を読む導線。
// 内容は docs/CONCEPT.md と lib/congestion/estimate.ts の実装に忠実に保つこと。
export const metadata: Metadata = {
  title: "この作品の仕組み",
  description:
    "東京レイルコンフォートがどのオープンデータをどう掛け合わせ、なぜ実測ではなく推定で解いているかを正直に説明します",
  openGraph: {
    title: "この作品の仕組み | 東京レイルコンフォート",
    description:
      "国交省の混雑率統計×時刻表×リアルタイム運行情報で東京の電車の混雑を推定する仕組みと、その限界を正直に説明します",
    url: "/about",
  },
};

// アクセント色（トップの快適＝緑と統一する 1 色）
const ACCENT = "#2e9e5b";

// 推定式の各項（README「推定モデル」表と estimate.ts / estimate-lines.ts に一致）
const MODEL_TERMS: readonly {
  term: string;
  source: string;
  status: string;
  statusKind: "real" | "provisional" | "rule" | "realtime";
}[] = [
  {
    term: "ベース混雑率",
    source: "国交省 令和6年度 都市鉄道混雑率調査の路線最大値",
    status: "実データ",
    statusKind: "real",
  },
  {
    term: "区間ウェイト",
    source: "駅別乗降人員から按分（未取得の路線は区間ごとの相対差で暫定按分）",
    status: "一部実データ／未取得時は暫定",
    statusKind: "provisional",
  },
  {
    term: "時間帯係数",
    source: "通勤需要カーブの近似（ODPT 駅時刻表由来の本数で置換予定）",
    status: "暫定",
    statusKind: "provisional",
  },
  {
    term: "曜日係数",
    source: "平日 1.0 ／ 土休日 0.7",
    status: "経験則",
    statusKind: "rule",
  },
  {
    term: "遅延補正",
    source: "ODPT 運行情報の遅延分 × +2%/分（上限 +50%・25分でキャップ）",
    status: "リアルタイム（ルールベース）",
    statusKind: "realtime",
  },
];

// 5 段階レベルの境界（estimate.ts の LEVEL_THRESHOLDS と国交省の混雑率目安）
const LEVELS: readonly {
  range: string;
  level: string;
  guide: string;
  fill: string;
  onFill: string;
}[] = [
  {
    range: "〜100%",
    level: "快適",
    guide: "定員乗車（座席・つり革・手すりが埋まる）",
    fill: "#2e9e5b",
    onFill: "#ffffff",
  },
  {
    range: "100〜150%",
    level: "やや混雑",
    guide: "新聞が楽に読める",
    fill: "#8fb93b",
    onFill: "#1f2937",
  },
  {
    range: "150〜180%",
    level: "混雑",
    guide: "肩が触れ合う（新聞は折れば読める）",
    fill: "#e6a817",
    onFill: "#1f2937",
  },
  {
    range: "180〜200%",
    level: "かなり混雑",
    guide: "体が触れ合うが週刊誌なら読める",
    fill: "#e2703a",
    onFill: "#ffffff",
  },
  {
    range: "200%〜",
    level: "激しい混雑",
    guide: "体が触れ合い相当の圧迫感",
    fill: "#cb2e2e",
    onFill: "#ffffff",
  },
];

// 使っているオープンデータ（README / ENTRY の一覧・出典 URL 付き）
const DATA_SOURCES: readonly {
  name: string;
  provider: string;
  use: string;
  status: string;
  statusKind: "real" | "provisional" | "realtime" | "master";
  url: string;
}[] = [
  {
    name: "都市鉄道の混雑率調査（令和6年度実績）",
    provider: "国土交通省",
    use: "区間別ベース混雑率（推定の土台）",
    status: "実データ",
    statusKind: "real",
    url: "https://www.mlit.go.jp/report/press/tetsudo04_hh_000138.html",
  },
  {
    name: "列車運行情報 odpt:TrainInformation",
    provider: "公共交通オープンデータセンター（ODPT）",
    use: "遅延・運休のリアルタイム補正",
    status: "リアルタイム",
    statusKind: "realtime",
    url: "https://www.odpt.org/",
  },
  {
    name: "駅時刻表 odpt:StationTimetable",
    provider: "ODPT",
    use: "時間帯別本数 → 時間帯係数の算出",
    status: "暫定（置換予定）",
    statusKind: "provisional",
    url: "https://www.odpt.org/",
  },
  {
    name: "列車時刻表 odpt:TrainTimetable",
    provider: "ODPT",
    use: "時間帯係数の補完",
    status: "暫定（置換予定）",
    statusKind: "provisional",
    url: "https://www.odpt.org/",
  },
  {
    name: "駅別乗降人員",
    provider: "東京都オープンデータカタログ／各鉄道事業者",
    use: "区間ウェイトの按分",
    status: "一部実データ／未取得時は暫定",
    statusKind: "provisional",
    url: "https://portal.data.metro.tokyo.lg.jp/",
  },
  {
    name: "駅情報 odpt:Station",
    provider: "ODPT",
    use: "駅マスタ（座標・駅順）",
    status: "マスタ",
    statusKind: "master",
    url: "https://www.odpt.org/",
  },
  {
    name: "路線情報 odpt:Railway",
    provider: "ODPT",
    use: "路線マスタ・駅順",
    status: "マスタ",
    statusKind: "master",
    url: "https://www.odpt.org/",
  },
  {
    name: "列車在線位置 odpt:Train",
    provider: "ODPT",
    use: "運行乱れの検知（拡張）",
    status: "拡張（未使用）",
    statusKind: "master",
    url: "https://www.odpt.org/",
  },
];

const STATUS_STYLE: Record<string, string> = {
  real: "bg-emerald-50 text-emerald-800 border-emerald-300",
  realtime: "bg-sky-50 text-sky-800 border-sky-300",
  provisional: "bg-amber-50 text-amber-800 border-amber-400",
  rule: "bg-gray-100 text-gray-700 border-gray-300",
  master: "bg-gray-100 text-gray-700 border-gray-300",
};

function StatusChip({ kind, label }: { kind: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${
        STATUS_STYLE[kind] ?? STATUS_STYLE.rule
      }`}
    >
      {label}
    </span>
  );
}

function SectionHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-bold text-gray-900 sm:text-xl">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: ACCENT }}
      >
        {n}
      </span>
      {title}
    </h2>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6">
      {/* ヘッダー */}
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 text-sm font-bold hover:underline"
          style={{ color: ACCENT }}
        >
          ← トップに戻る
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          この作品の仕組み
        </h1>
        <p className="max-w-2xl text-sm text-gray-600">
          東京レイルコンフォートが どのオープンデータを どう掛け合わせ なぜ「実測」ではなく「推定」で解いているのかを 正直に説明します
        </p>
        <p className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          ⚠️ このページで説明する混雑度は 実測ではなく推定です（統計 × 時刻表 × 運行情報から算出） 区間按分・時間帯カーブには暫定値を含みます
        </p>
      </header>

      {/* 1. なぜ推定なのか */}
      <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <SectionHeading n={1} title="なぜ「推定」なのか" />
        <p className="text-sm leading-relaxed text-gray-700">
          リアルタイムの車両別・列車別の「実測」混雑度は 東京の電車のオープンデータに存在しません だからこの作品は 実測をあきらめ 複数のオープンデータの掛け合わせで推定します
        </p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700">
          <li className="rounded-md bg-gray-50 px-4 py-2">
            東京メトロ・都営の ODPT リアルタイムは 運行情報（遅延・運休）と GTFS-RT の Alert のみ 混雑は含まれません
          </li>
          <li className="rounded-md bg-gray-50 px-4 py-2">
            JR 東日本の GTFS-RT には occupancy（混雑）フィールドが入っていません
          </li>
          <li className="rounded-md bg-gray-50 px-4 py-2">
            各社アプリ（my! Tokyo Metro 等）が持つ車両別混雑は非公開です
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-gray-700">
          「実測が無い」という制約を <span className="font-bold" style={{ color: ACCENT }}>統計 × 時刻表 × 運行情報の掛け合わせ</span> で乗り越えるのが この作品の核心です UI では常に「これは実測ではなく推定です」と明示します
        </p>
      </section>

      {/* 2. 推定の仕組み */}
      <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <SectionHeading n={2} title="推定の仕組み" />
        <p className="text-sm leading-relaxed text-gray-700">
          推定の中心は 副作用のない純関数（
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[13px] text-gray-800">
            lib/congestion/estimate.ts
          </code>
          ）です 次の式で区間×時間帯の推定混雑率を出します
        </p>
        <div className="overflow-x-auto rounded-md border-l-4 bg-gray-50 px-4 py-3" style={{ borderColor: ACCENT }}>
          <code className="block whitespace-nowrap font-mono text-[13px] leading-relaxed text-gray-800 sm:text-sm">
            推定混雑率(%) = ベース混雑率(区間) × 時間帯係数 × 曜日係数 × 遅延補正(遅延分)
          </code>
        </div>

        <h3 className="mt-1 text-sm font-bold text-gray-900">各項が どのデータ由来か</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="py-2 pr-3 font-bold">項</th>
                <th className="py-2 pr-3 font-bold">出どころ</th>
                <th className="py-2 font-bold">現状</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_TERMS.map((t) => (
                <tr key={t.term} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3 font-bold text-gray-900">{t.term}</td>
                  <td className="py-2 pr-3 text-gray-700">{t.source}</td>
                  <td className="py-2">
                    <StatusChip kind={t.statusKind} label={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-2 text-sm font-bold text-gray-900">
          5 段階レベルの境界と 国交省の混雑率目安
        </h3>
        <p className="text-sm leading-relaxed text-gray-700">
          推定混雑率(%) を 国交省の混雑率の目安（定員乗車 = 100%）に合わせて 5 段階へマッピングします 0–1 の指数へは「混雑率 200% = 1.0」で正規化します
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="py-2 pr-3 font-bold">推定混雑率</th>
                <th className="py-2 pr-3 font-bold">レベル</th>
                <th className="py-2 font-bold">国交省の目安</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((lv) => (
                <tr key={lv.level} className="border-b border-gray-100 align-top">
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-[13px] text-gray-800">
                    {lv.range}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold"
                      style={{ backgroundColor: lv.fill, color: lv.onFill }}
                    >
                      {lv.level}
                    </span>
                  </td>
                  <td className="py-2 text-gray-700">{lv.guide}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. 使っているオープンデータ */}
      <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <SectionHeading n={3} title="使っているオープンデータ" />
        <p className="text-sm leading-relaxed text-gray-700">
          データを 正直に 3 つに区別します <span className="font-bold">実データ</span>（国交省の混雑率）を土台に <span className="font-bold">暫定</span>（区間按分・時間帯カーブ）で肉付けし <span className="font-bold">リアルタイム</span>（ODPT 運行情報の遅延）で今を補正します
        </p>
        <div className="flex flex-wrap gap-2">
          <StatusChip kind="real" label="実データ = 国交省 混雑率" />
          <StatusChip kind="provisional" label="暫定 = 区間按分・時間帯カーブ" />
          <StatusChip kind="realtime" label="リアルタイム = ODPT 運行情報" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="py-2 pr-3 font-bold">データ</th>
                <th className="py-2 pr-3 font-bold">提供元</th>
                <th className="py-2 pr-3 font-bold">用途</th>
                <th className="py-2 font-bold">現状</th>
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map((d) => (
                <tr key={d.name} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3 font-bold text-gray-900">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: ACCENT }}
                    >
                      {d.name}
                    </a>
                  </td>
                  <td className="py-2 pr-3 text-gray-700">{d.provider}</td>
                  <td className="py-2 pr-3 text-gray-700">{d.use}</td>
                  <td className="py-2">
                    <StatusChip kind={d.statusKind} label={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-gray-500">
          国交省 混雑率調査の一次資料（PDF）:{" "}
          <a
            href="https://www.mlit.go.jp/report/press/content/001904497.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: ACCENT }}
          >
            資料2
          </a>
          {" / "}
          <a
            href="https://www.mlit.go.jp/report/press/content/001902900.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: ACCENT }}
          >
            資料3
          </a>
          {" ｜ 対象路線（MVP）: JR山手線 / JR中央快速線 / 東京メトロ東西線"}
        </p>
      </section>

      {/* 4. この推定の限界 */}
      <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <SectionHeading n={4} title="この推定の限界（正直に）" />
        <p className="text-sm leading-relaxed text-gray-700">
          誠実さを保つため 現時点で できていないことを隠さず書きます
        </p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700">
          <li className="flex gap-2 rounded-md bg-gray-50 px-4 py-2">
            <span className="font-bold text-amber-700">暫定</span>
            <span>区間ごとの按分と時間帯カーブは暫定値です（駅別乗降人員・ODPT 時刻表由来の実データで置換していく計画）</span>
          </li>
          <li className="flex gap-2 rounded-md bg-gray-50 px-4 py-2">
            <span className="font-bold text-amber-700">按分</span>
            <span>駅別乗降人員は「駅の乗り降り」であって「区間を通過する需要」そのものではないため 按分は近似にとどまります</span>
          </li>
          <li className="flex gap-2 rounded-md bg-gray-50 px-4 py-2">
            <span className="font-bold text-amber-700">粒度</span>
            <span>方向別（上り／下り）の非対称や 優等列車（快速・各停）の差は現状 未表現で 路線最大値ベースで見ています</span>
          </li>
          <li className="flex gap-2 rounded-md bg-gray-50 px-4 py-2">
            <span className="font-bold text-amber-700">補正</span>
            <span>遅延補正はルールベース（+2%/分）で 実測データによる較正はまだ行っていません 祝日判定も未対応です</span>
          </li>
          <li className="flex gap-2 rounded-md bg-gray-50 px-4 py-2">
            <span className="font-bold text-amber-700">前提</span>
            <span>そもそも これは実測ではなく推定です 実際の運行状況は各鉄道事業者の公式情報を確認してください</span>
          </li>
        </ul>
      </section>

      {/* 5. 今後（Phase2） */}
      <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <SectionHeading n={5} title="今後の構想（Phase2）" />
          <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
            未実装
          </span>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          以下は まだ実装していない構想です（docs/CONCEPT.md 準拠） 推定を「当てにいく」ためのデータ生成ループを回す方向です
        </p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700">
          <li className="rounded-md bg-gray-50 px-4 py-2">
            <span className="font-bold text-gray-900">遅延履歴の蓄積による較正</span>
            {" — 運行情報を定期的に記録する仕組みは用意していますが その履歴を推定精度に反映する較正は未実装です"}
          </li>
          <li className="rounded-md bg-gray-50 px-4 py-2">
            <span className="font-bold text-gray-900">ユーザー投稿での補正</span>
            {" — 混雑報告をクラウドソースで集めて推定の事後補正に足す構想です スキーマは用意済みですが MVP では未使用です"}
          </li>
          <li className="rounded-md bg-gray-50 px-4 py-2">
            <span className="font-bold text-gray-900">暑さデータとの掛け合わせ</span>
            {" — 気温・暑さ指数と掛けて「空いていて涼しい移動」を提案する構想です（未実装）"}
          </li>
        </ul>
      </section>

      {/* フッター（トップと同じ出典表示 + 戻る導線） */}
      <footer className="mt-2 flex flex-col gap-3 border-t border-gray-200 pt-4 text-[11px] leading-relaxed text-gray-500">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 text-sm font-bold hover:underline"
          style={{ color: ACCENT }}
        >
          ← トップに戻る
        </Link>
        <p>本アプリは公共交通オープンデータセンターのデータを利用しています</p>
        <p>
          混雑率は国土交通省 令和6年度 都市鉄道の混雑率調査結果を基礎データとした推定です（区間ごとの差は暫定の按分 時間帯カーブは暫定）
        </p>
        <p>
          リアルタイム運行情報にはデータ生成時刻（dc:date）を表示しています 静的データの取得日時・出典は各データの提供元に従います
        </p>
      </footer>
    </main>
  );
}
