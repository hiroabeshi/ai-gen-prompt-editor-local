# PromptEdit Implementation Rules for Anima

調査日: 2026-05-08 JST

目的: Anima / Anima 派生モデルで、ユーザー意図に追従しやすいプロンプトを安定して組み立てる。

## 1. 内部表現は「文字列」ではなく「意味つきトークン」に寄せる

タグをただの `string[]` として扱うと、順序、種別、表記ゆれ、artist の `@`、dataset tag の改行ルールを壊しやすい。内部的には最低限以下を持つ。

```ts
type AnimaPromptToken = {
  raw: string
  canonical: string
  section:
    | 'quality'
    | 'meta'
    | 'year'
    | 'safety'
    | 'count'
    | 'character'
    | 'series'
    | 'artist'
    | 'general'
    | 'negative'
  source?: 'user' | 'dictionary' | 'png' | 'ai-import'
  aliases?: string[]
}
```

`datasetTag` と `freeText` は通常タグとは別フィールドにする。

## 2. 出力順は公式タグ順に固定する

Positive prompt の出力順:

1. `datasetTag` があれば先頭に出し、改行する。
2. `quality`, `meta`, `year`, `safety`
3. `count`
4. `character`
5. `series`
6. `artist`
7. `general`
8. `freeText`

同一セクション内はユーザーが並べた順番を保つ。公式ではセクション内の順序は任意だが、ユーザーの意図や重みづけに近い情報として保存する。

## 3. タグ正規化は保存時と出力時の二段階にする

保存時:

- trim する。
- 複数空白を単一 space にする。
- `@` 付き artist は許容する。
- ユーザー入力はなるべく破壊しない。

出力時:

- 通常タグは lowercase にする。
- `_` は space に変換する。
- ただし `score_1` から `score_9` は例外として `_` を保持する。
- `artist` セクションで `@` がなければ自動付与する。
- 空タグ、重複タグ、矛盾タグを除去または警告する。

## 4. Safety tag は専用フィールドにする

`safe`, `sensitive`, `nsfw`, `explicit` は positive prompt で 1 つ選ぶ UI にする。通常パーツとして複数追加できる構造にすると、意図が割れやすい。

これは公式明記仕様ではなく、PromptEdit の実装判断。

## 5. Quality preset は「推奨値」扱いにする

初期 positive prefix:

```text
masterpiece, best quality, score_7, safe
```

初期 negative:

```text
worst quality, low quality, score_1, score_2, score_3, artist name
```

ユーザーが外せる preset として実装する。Anima 公式は quality tags なしでも使えるとしているため、固定で強制しない。

## 6. Natural language は削らない

Anima は自然言語キャプションも学習している。タグ列に変換しきれない関係性、構図、キャラクター間の相互作用は free text に残す。

Lint:

- pure natural language が 1 文以下なら詳細不足として警告する。
- character 名だけで appearance がない場合は警告する。
- 複数 character があるのに appearance / outfit / pose が共有タグだけの場合は混線リスクを警告する。

## 7. Character prompt はグループ化できる構造にする

複数キャラクターの追従性を上げるには、キャラクターごとのタグを束ねるのが重要。

UI の基本構成:

```text
メイン
キャラ1〜X
自然言語
```

メインは quality / safety / count / style / background / camera / lighting / artist など、画像全体にかかるタグだけを扱う。キャラ1〜X は position / appearance / outfit / expression / action / item / other を持つ。自然言語欄は 1 か所に集約し、キャラ同士の関係、左右、前後、視線、相互作用などを書く場所にする。

メインやキャラ欄を自由テキスト化しすぎない。キャラ欄はタグや短い phrase の集合として扱い、最終 prompt では `Left girl: ...` のような scoped cluster へ変換する。

キャラ1〜X はキャラ単位の `enabled` toggle を持つ。`enabled=false` のキャラは保存 JSON には残すが、final prompt の scoped cluster と count tag 自動生成からは除外する。

推奨構造:

```ts
type CharacterBlock = {
  character: string
  enabled: boolean
  series?: string
  appearanceTags: string[]
  outfitTags: string[]
  poseTags: string[]
  relationText?: string
}
```

最終出力は Anima のタグ順に合わせるが、UI と保存形式ではキャラクター別に編集できるとよい。

複数キャラ構図では、キャラ固有の outfit / action / item を単純に global general tag へ平坦化しない。最終 prompt では以下のような scoped cluster を使い、キャラごとの属性を見失わないようにする。

```text
Center man: black clothes, standing.
Left girl: eating ice cream, ice cream, crying, tears, open mouth.
Right girl: holding a net, net, smile.

The two girls stand on either side of the man.
```

この scoped cluster は完全な英文でなくてよい。`crying`, `screaming`, `open mouth` のような状態・表情・動作タグを無理に流暢な英文へ変換すると意味を壊しやすいため、キャラ別の半タグ半自然文として保持する。

## 8. Artist は `@` を UI 上でも明示する

公式では artist tag に `@` が必要。PromptEdit では以下を行う。

- artist セクションの表示ラベルに `@` 必須を示す。
- 入力が `big chungus` でも出力は `@big chungus` にする。
- `@` なしで保存された既存データは出力時に補正する。
- negative の `artist name` は artist セクションとは別扱いにする。
- ComfyUI / Forge Neo 向け final prompt では、artist tag などに含まれるリテラルな括弧を `\(name\)` のように escape する。未 escape の `()` は weight 構文として解釈される可能性がある。

## 9. Danbooru / Gelbooru 表記ゆれを alias で吸収する

ユーザー指示により Danbooru タグが効く前提。ただし公式は Danbooru と Gelbooru に差がある場合は Gelbooru 版を優先するとしている。

実装方針:

- 辞書は `canonical` と `aliases` を持つ。
- 入力や PNG 取り込みでは Danbooru 版でも hit させる。
- 出力は Gelbooru 優先の canonical に寄せる。
- 自動変換した場合は UI 上で確認できるようにする。

## 10. Dataset tag は通常タグ配列に入れない

`deviantart` や `ye-pop` はプロンプト先頭の行として扱う。カンマ区切りタグ列に混ぜると仕様から外れる。

```text
deviantart
masterpiece, best quality, ...
```

通常のアニメ生成では空欄にする。上級設定として折りたたむのがよい。

## 11. Weight は backend adapter の責務にする

Anima 公式仕様には weight 構文の明記がない。ComfyUI 向け出力では `(tag:1.2)` を使うが、これは Anima モデル仕様ではなく ComfyUI 側の構文。

実装方針:

- `weight === 1` は裸タグ。
- `weight !== 1` は backend adapter が整形する。
- ComfyUI adapter: `(tag:1.2)`
- Anima spec document では「重み仕様あり」と断定しない。

複数キャラ構図では、キャラ固有 action / item の weight を裸の global tag として出すと他キャラへ漏れる可能性がある。

避ける例:

```text
(eating ice cream:1.25)
```

代替:

```text
Left girl: (eating ice cream:1.15), ice cream.
```

キャラ別 scoped cluster 内の weight は、global tag に出すよりもキャラへ寄る可能性が高い。

```text
Left girl: eating ice cream, ice cream, crying, screaming, (tears:1.5), open mouth.
```

または:

```text
(left girl eating ice cream:1.15)
```

ただし scoped phrase でも完全な拘束は保証できないため、lint warning と final prompt preview で明示する。行動系の強調は「注目度」と「動作量・見た目の変更」が混ざりやすいので、プログラムが `clearly eating` のような自然文へ勝手に言い換えない。

通常 UI の weight 範囲は控えめにし、極端な値は詳細設定または直接入力扱いにする。

## 12. Randomizer はクライアント側で展開する

Anima モデル自体に prompt randomizer 構文はない。NovelAI 由来の `||a|b||` のような記法をそのまま出すとモデルに無意味な文字列として渡る可能性がある。

実装方針:

- ランダム候補は保存形式では保持する。
- コピーまたは生成前に PromptEdit 側で 1 つへ展開する。
- 展開結果をプレビューに表示する。

## 13. Lint ルール

PromptEdit の lint で警告したいもの:

- 通常タグに `_` が含まれる。ただし `score_1` から `score_9` は除外。
- artist セクション外に `@...` がある。
- artist セクションなのに出力前 canonical が空。
- safety tag が複数ある。
- `year 2025` と `newest` などの時代タグが過剰に併用されている。
- pure natural language が短すぎる。
- dataset tag が通常タグ列に混ざっている。
- negative が長すぎる、または positive の主要意図を否定している。

Character block の lint は以下だけに絞る。

- キャラブロックに role がない。
- キャラブロックに position がない。

## 14. Prompt preview は最終出力をそのまま見せる

追従性を上げるには、ユーザーが「実際に渡る文字列」を確認できることが重要。

表示するもの:

- 正規化前のユーザー入力
- 正規化後の canonical tags
- セクション順に並んだ final prompt
- backend adapter 適用後の final prompt
- lint warnings

複数キャラ構図では、特に以下を preview で確認できるようにする。

- キャラ固有タグが global tag へ漏れていないか。
- scoped cluster がどの文字列として出るか。
- ComfyUI / Forge Neo adapter で括弧 escape と weight 構文がどう適用されるか。

## 15. PNG メタデータ取り込みはサンプルで実測する

Anima そのものの仕様と、ComfyUI が PNG に埋める workflow / prompt metadata は別物。PNG import は必ず実際の ComfyUI 出力 PNG を複数枚使って確認する。

最低確認:

- positive prompt の場所
- negative prompt の場所
- sampler / scheduler / steps / CFG / seed の場所
- workflow JSON のノード構造差分
- 再エンコード済み画像で metadata が消えていないか

## 16. 実装優先度

1. タグ正規化と公式順序の generator。
2. safety / quality / artist / datasetTag の専用フィールド化。
3. prompt lint。
4. character block。
5. alias dictionary。
6. PNG metadata import の実測対応。

## 17. v2.0.0 JSON import

`version: "2.0.0"` の既存 JSON を読み込む場合、既存 slot 内容は一括で `メイン` に移す。自然文らしい内容や `left girl` 風の疑似構文があっても、自動で `自然言語` や `キャラ1〜X` へ分配しない。

明確な free text フィールドだけ `自然言語` に移す。明確な negative フィールドだけ `ネガティブ` に移す。それ以外の positive / slot 内容は `メイン` に集約する。

読み込み時に、character block への手動分解を提案する warning は出さない。移行 import は判断を入れず、一括移動だけを行う。

## 18. v2.1.0 JSON save format

キャラブロック対応後の保存 JSON は `version: "2.1.0"` とする。

`version: "2.0.0"` を読み込んだ場合も、保存時は `version: "2.1.0"` として新構造で出力する。

保存構造の要点:

- `main`: 画像全体にかかる positive パーツを保持する。
- `characters`: キャラ1〜X の配列を保持する。
- `naturalLanguage`: 関係 caption 用の自由テキストを保持する。
- `negative`: negative パーツを保持する。

`characters[]` は以下を持つ。

```ts
type CharacterBlock = {
  id: string
  label: string
  enabled: boolean
  role: string
  position: 'left' | 'center' | 'right' | 'foreground' | 'background' | 'custom' | ''
  customPosition?: string
  appearance: SelectedPart[]
  outfit: SelectedPart[]
  expression: SelectedPart[]
  action: SelectedPart[]
  item: SelectedPart[]
  other: SelectedPart[]
}
```

`naturalLanguage` は文字列として保存する。キャラごとの scoped cluster に入る内容は `characters[]` 側に保存し、`naturalLanguage` へ混ぜない。

`enabled=false` の character も保存する。出力時だけ対象から外し、後で 3 キャラ構図から 2 キャラ構図へ切り替えるような試行をしやすくする。

v2.1.0 保存時は、final prompt 文字列そのものを正本として保存しない。final prompt は `main` / `characters` / `naturalLanguage` / `negative` から生成する preview / export 結果として扱う。
