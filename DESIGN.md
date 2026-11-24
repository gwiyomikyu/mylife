# MY LIFE 設計メモ（Phase 1）

## 画面構成

下部固定ナビ（HOME / HABITS / MONEY / BODY）＋ HOME右上の歯車から SETTINGS。
入力・編集はすべて下から出るシート（ボトムシート）で行い、画面遷移を減らして片手で完結させる。

| 画面 | 実装 | 主な内容 |
|---|---|---|
| HOME | `screens/Home.tsx` | 日付・あいさつ・日替わりメッセージ・今月の目標 / DAILY PROGRESS / 今日のチェックリスト（直接チェック可）/ MONEY・BODY・WEEKLY サマリー。日曜・1日は週次・月次チェックへの案内を表示 |
| HABITS | `screens/Habits.tsx` | 日次・週次・月次の切替、週ストリップ（日ごとの達成リング）、過去日・過去週・過去月への移動、休息日の設定 |
| HABIT DETAIL | `screens/HabitEditor.tsx` | 追加・編集・削除、達成履歴（直近28日／12週／12か月）、継続日数 |
| MONEY / MONEY INPUT | `screens/Money.tsx` | 月切替、収支差額・収入・支出・貯金、予算残高（85%超で控えめな案内）、カテゴリ別支出、明細（タップで編集・削除） |
| BODY / BODY INPUT | `screens/Body.tsx` | 体重（最新・初期・目標・差・今月の変化・推移ライン）、運動（今週/今月回数・時間・ランニング距離）、記録一覧（タップで編集・削除） |
| SETTINGS | `screens/Settings.tsx` | ニックネーム・今月の目標・予算・貯金目標・体重目標・運動目標・支払い方法、家計簿カテゴリ管理、JSONバックアップ／復元、CSV出力、サンプル記録の削除 |

## データ構造（IndexedDB / Dexie、`db/types.ts`）

日付はすべてローカル時刻の `YYYY-MM-DD` 文字列。

- `habits`：name, category, frequency（daily / weekdays / weekly / monthly）, weekdays[], optional（任意の日）, targetCount, startDate, memo, order, archived
- `habitLogs`：habitId, periodKey, count。periodKey は 日次=日付、週次=その週の月曜日、月次=`YYYY-MM`。`[habitId+periodKey]` で一意
- `restDays`：休息日（その日は達成率計算から除外）
- `categories`：type（expense / income / saving）, name, note, order, budget?（Phase 2 用）
- `transactions`：date, type, amount（円・整数）, categoryId, method, memo
- `weights`：date, weight, bodyFat?, memo（1日1件、同日は上書き）
- `workouts`：date, type, minutes, distanceKm?, memo
- `kv`：設定（settings）など
- Phase 2 用に先に用意：`health`（睡眠・食事・水分・体調・疲労度）、`journals`（日次/週次/月次の振り返り）、`savingsGoals`

## 達成率のルール（`lib/habits.ts`）

- 分母は「その日（期間）に実施対象となる習慣」だけ。開始日前・対象外の曜日は含めない
- 「任意の日」の習慣は、やった日だけ分母・分子に加える（やらなくても下がらない）
- 休息日は日次・週次集計から除外
- 継続日数は、今日まだ未チェックでも昨日までの連続で数える。対象外の日・休息日では途切れない
- 未達成を赤で強調しない（色は淡いグリーン／ベージュのみ）

## 保存とバックアップ

- IndexedDB に即時保存。起動時に `navigator.storage.persist()` をリクエスト
- JSON バックアップは全テーブルを書き出し、復元時は全テーブルを置き換え
- 家計簿 CSV は BOM 付き UTF-8（Excel で文字化けしない）
- 外部への送信は一切なし

## 次のフェーズで足す場所

- Phase 2：月間カレンダー（Habits に view 追加）、家計簿グラフ（Money に分析タブ）、カテゴリ別予算（`categories.budget`）、貯金目標（`savingsGoals`）、振り返り（`journals`）
- Phase 3：PWA（manifest + service worker）、リマインダー


## Phase 2（2026-11-24）

- MONEY に「グラフ」タブ（`screens/MoneyCharts.tsx`）：支出の推移（予算線つき）、カテゴリ別の割合（ドーナツ、上位5＋その他）、収支の推移、貯金総額の推移。6か月／12か月。棒・線をタップでその月の数字
- カテゴリ別予算：家計簿の予算カードから「カテゴリ別の予算を設定」（`categories.budget`）。超えても赤は使わず控えめな色
- BODY：体重グラフに期間（1か月／3か月／1年／すべて）と目標線、週ごとの運動回数グラフ
- HABITS に「カレンダー」（`screens/HabitCalendar.tsx`）：達成率で色の濃さが変わる月表示、運動・ふりかえりの印、日ごとの詳細、習慣ごとの月の達成
- JOURNAL（`screens/Journal.tsx`、ナビ外の画面 `#journal`）：日次・週次・月次。その期間の数字を上に表示、入力は自動保存、過去の記録一覧。HOME の「ふりかえり」カードとカレンダーから開く
- グラフ部品は `components/charts.tsx`（BarChart / LineChart / Donut）。色はテーマの CSS 変数に従う
- 色のカスタマイズ：`lib/palette.ts`（4色→全変数、コントラスト自動補正）、設定画面の「Color」

## REFLECT タブ（2026-11-24）

- 下部ナビ7つ目「REFLECT」（`screens/Reflect.tsx`）。「目標」と「ふりかえり」（JOURNAL を内包、`#journal` は REFLECT のふりかえりに開く）
- 目標（`screens/ReflectGoals.tsx`、Dexie v6 `lifeGoals`）：期間 5年後/3年後/1年後/半年/3か月/1か月。目標・なぜ・期限・進み具合（自己評価%）・現在地・これからどうする・次のステップ（チェックリスト）・つながる長期目標（parentId）・つながる習慣（habitIds、今週の達成を表示）・見直しの記録（checkins）・達成
- 表示は長期の目標の下に短期の目標をツリー状に表示。HOME のふりかえりカードは近道として残す
- ナビは7つでも 320px で収まるよう、ラベルを min(10px, 2.65vw) に

## タブの位置（2026-11-24）

- 既定は左横の細いタブ列（幅52px、アイコン＋小さい英字）。設定「Layout タブの位置」で「左横／下」を切替（settings.navPosition）
- ＋ボタンと通知の高さは CSS 変数 `--fab-bottom` でタブ位置に合わせる

## Phase 3（2026-11-24）

- PWA：`PWA=1 npx vite build` で `dist-pwa/`（1ファイルの index.html ＋ manifest.webmanifest・sw.js・アイコン）。静的ホスティング（GitHub Pages 等）に置けばホーム画面追加・全画面・オフライン起動が可能。claude.ai の共有ページ版（SINGLE=1 → dist）では service worker は登録しない
- sw.js：ページ本体はネット優先（つながらなければ保存版）、アイコン・フォントは保存版優先。記録データ（IndexedDB）には触れない
- リマインダー：iOS の Web Push は通知サーバーが必要なため使わず、設定「Reminder」から iPhone カレンダー用 .ics（繰り返し＋通知）を書き出す（`lib/ics.ts`）。HOME では設定時刻を過ぎて未チェックがあればお知らせ。PWA 版はアイコンバッジに残り件数
- 仕上げ：画面切り替えのフェード、全部できたときの小さなお祝い（Burst）
