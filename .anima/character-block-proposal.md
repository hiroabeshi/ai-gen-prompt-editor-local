# Character Block Proposal for Anima PromptEdit

作成日: 2026-05-08 JST
実装完了日: 2026-05-10 JST

目的: 人間が PromptEdit を使うときに、「誰が何をしているか」を手で疑似構文化しなくても、Anima に追従しやすい prompt を組めるようにする。

## 1. 問題

例:

```text
黒い服の男の左右に少女がいて、左の少女はアイスを食べており、右の少女は網を持っている
```

現状のタグ中心 UI では、以下のようなタグは入れられる。

```text
1boy, 2girls, black clothes, ice cream, eating, net, holding
```

しかしこれだけでは、Anima には以下の対応関係が伝わりにくい。

- `black clothes` は男の服
- `ice cream` と `eating` は左の少女
- `net` と `holding` は右の少女
- 男は中央、少女たちは左右

その結果、人間が以下のような独自ルールを手で書く必要が出る。

```text
man: black clothes
left girl: eating ice cream
right girl: holding a net
```

これは毎回大変で、アプリが支援すべき構造をユーザーが自然言語欄で肩代わりしている状態。

## 2. 基本方針

PromptEdit は単なる「タグの袋」ではなく、以下の意味構造を保持する。

- 全体の画風・品質・背景・構図
- キャラごとの外見・服装・表情・行動・持ち物・位置
- キャラ同士の関係と配置

最終出力は、Anima の特性に合わせて **全体タグ列 + キャラ別 scoped cluster + 関係 caption** にする。

Anima 公式は Danbooru-style tags と natural language captions とその混在を学習しているため、キャラごとの紐づきはタグだけで無理に表現しない。ただし、`crying`, `screaming`, `smile`, `black clothes` のようなタグをすべて流暢な英文へ変換するのも危険なので、キャラ別に scope された半タグ半自然文の cluster を使う。

## 3. 推奨 UI 構造

基本画面は、以下の構成にする。

```text
メイン

キャラ1〜X
  - enabled
  - role / label
  - position
  - appearance
  - outfit
  - expression
  - action
  - item
  - other

自然言語
```

メインは画像全体にかかるタグだけを扱う。キャラ1〜X はキャラ固有のタグや短い phrase を扱い、最終出力では `Left girl: ...` のような scoped cluster になる。自然言語欄は、キャラ同士の関係、左右、前後、視線、相互作用など、関係 caption を書く場所にする。

キャラブロックには全体の活性 / 非活性 toggle を持たせる。3キャラ構図を作った後で、2キャラ版のイラストを試すことは多いため、キャラ単位で一時的に出力から外せるようにする。

重要: 自然言語の自由入力欄は基本的にこの 1 か所へ寄せる。メインやキャラ欄を自由テキスト化しすぎると、どの情報が global でどの情報が character scoped なのかが見えにくくなる。

### 全体ブロック

画像全体にかかる要素を扱う。

- quality: `masterpiece`, `best quality`, `score_7`
- safety: `safe`, `sensitive`, `nsfw`, `explicit`
- meta / style: `anime illustration`, `official art`, `highres`
- era: `year 2025`, `newest`, `recent`
- background: `outdoors`, `classroom`, `simple background`
- camera / composition: `wide shot`, `upper body`, `from side`
- lighting / mood: `soft lighting`, `dramatic lighting`
- global free text

このブロックは既存の positive slot の `quality` / `other` の発展形。キャラ固有の服装・行動・持ち物は原則としてここに置かない。

### キャラブロック

デフォルトで `キャラ1` から `キャラ3` を用意する。必要に応じて追加可能にする。

各キャラブロックの項目:

| 項目 | 例 | 出力先 |
|---|---|---|
| enabled | true / false | 出力対象 |
| role | man, girl, boy, woman | count / caption |
| position | center, left, right, foreground | caption |
| character name | Fern | character tag / caption |
| series | Sousou no Frieren | series tag / caption |
| appearance tags | long purple hair, purple eyes | tag / caption |
| outfit tags | black clothes, white dress | tag / caption |
| expression tags | smile, open mouth | tag / caption |
| pose / action tags | standing, eating ice cream | scoped cluster 優先 |
| held item / object | ice cream, net | scoped cluster 優先 |
| free text | slightly nervous, looking at the man | caption |

重要: キャラブロック内のタグは、最終出力で単純に全体タグへ混ぜない。キャラごとの scoped cluster として出し、「この属性はこのキャラに属する」という情報を保つ。

### 関係・構図ブロック

キャラ間の関係や全体配置を扱う。

- `Character 1 stands in the center.`
- `Character 2 is on his left.`
- `Character 3 is on his right.`
- `The two girls stand on either side of the man.`

タグだけでは弱い要素なので、自然言語 caption を主出力にする。

## 3.5 最終 prompt の基本形

最終 prompt は以下の 3 層で組む。

1. メインタグ列
   - quality / safety / count / style / background / camera / lighting / artist など、画像全体にかかる要素。
   - キャラ固有の服装・行動・持ち物は原則としてここへ混ぜない。

2. キャラ別 scoped cluster
   - `Center man: black clothes, standing.`
   - `Left girl: eating ice cream, ice cream, crying, tears, open mouth.`
   - `Right girl: holding a net, net, smile.`
   - 完全な英文ではなくてよい。キャラ名、位置、役割を見出しにして、そのキャラのタグや短い phrase を束ねる。
   - 見出しは `position + role` の順にする。例: `Left girl:`, `Center man:`
   - role が空なら `Left character:`、position が空なら `Character 1:` のように安全な見出しへ落とす。
   - `other` はそのキャラの scoped cluster 末尾に出す。
   - `enabled=false` のキャラは scoped cluster に出さない。count tag 自動生成でも人数に含めない。

3. 関係 caption
   - `The two girls stand on either side of the man.`
   - 左右、前後、視線、相互作用など、キャラ間の関係を自然文で書く。
   - 自然言語欄が空なら、最終 prompt では関係 caption の空行を出さない。

例:

```text
masterpiece, best quality, score_7, safe, 1boy, 2girls, anime illustration, soft lighting

Center man: black clothes, standing.
Left girl: eating ice cream, ice cream, crying, tears, open mouth.
Right girl: holding a net, net, smile.

The two girls stand on either side of the man.
```

この形は流暢な英文生成よりも、キャラごとの意味の閉じ込めを優先する。特に `crying` と `screaming` のような状態・表情・動作タグは、無理に `A girl is ...` へ変換すると不自然になりやすい。

## 4. 保存モデル案

```ts
type ScenePrompt = {
  global: GlobalPromptBlock
  characters: CharacterPromptBlock[]
  relationText: string
  negative: NegativePromptBlock
}

type GlobalPromptBlock = {
  qualityTags: string[]
  metaTags: string[]
  styleTags: string[]
  eraTags: string[]
  safety: 'safe' | 'sensitive' | 'nsfw' | 'explicit' | null
  backgroundTags: string[]
  compositionTags: string[]
  lightingTags: string[]
  freeText: string
}

type CharacterPromptBlock = {
  id: string
  label: string
  enabled: boolean
  role: string
  position: 'left' | 'center' | 'right' | 'foreground' | 'background' | 'custom' | ''
  customPosition?: string
  characterName?: string
  series?: string
  appearanceTags: string[]
  outfitTags: string[]
  expressionTags: string[]
  poseActionTags: string[]
  itemTags: string[]
  freeText: string
}

type NegativePromptBlock = {
  qualityTags: string[]
  artifactTags: string[]
  anatomyTags: string[]
  freeText: string
}
```

既存の `PromptPart` / `SelectedPart` は捨てなくてよい。各 tag 配列の中身を `SelectedPart[]` として保持すれば、既存のライブラリ、重み、ON/OFF、D&D を再利用できる。

## 5. 出力方針

### Positive prompt

出力は 3 層にする。

1. Anima 公式順に近いタグ列
2. キャラごとの scoped cluster
3. キャラ間の関係 caption

例:

```text
masterpiece, best quality, score_7, safe, highres, 1boy, 2girls, anime illustration, soft lighting

Center man: black clothes, standing.
Left girl: eating ice cream, ice cream.
Right girl: holding a net, net.

The two girls stand on either side of the man.
```

この形にすると、quality / style / count はタグで強く伝え、キャラごとの属性は scoped cluster に閉じ込め、キャラ同士の関係は自然文で明確に伝えられる。

### Character / series tags

版権キャラを使う場合、タグ列にも character / series を出す。

```text
masterpiece, best quality, score_7, safe, 1girl, fern, sousou no frieren

Fern: long purple hair, purple eyes, wearing ...

Digital artwork of Fern from Sousou no Frieren.
```

公式 tips と同じく、名前だけでなく基本外見を scoped cluster / caption 側にも入れる。

### Count tags

キャラブロックから `1boy`, `2girls` などを自動生成する。ただし user override を許可する。

例:

- role = `man` 1人 → `1boy` または `1male` のどちらを使うかは辞書方針で決める。
- role = `girl` 2人 → `2girls`
- role が曖昧なら count tag は自動生成せず warning。

## 6. 例

入力:

- 全体:
  - quality: `masterpiece`, `best quality`, `score_7`
  - safety: `safe`
  - style: `anime illustration`
  - lighting: `soft lighting`
- キャラ1:
  - role: `man`
  - position: `center`
  - outfit: `black clothes`
- キャラ2:
  - role: `girl`
  - position: `left`
  - action: `eating ice cream`
  - item: `ice cream`
- キャラ3:
  - role: `girl`
  - position: `right`
  - action: `holding a net`
  - item: `net`
- 関係:
  - `The two girls stand on either side of the man.`

出力:

```text
masterpiece, best quality, score_7, safe, 1boy, 2girls, anime illustration, soft lighting

Center man: black clothes, standing.
Left girl: eating ice cream, ice cream.
Right girl: holding a net, net.

The two girls stand on either side of the man.
```

## 7. 既存 UI からの移行案

### Step 1: 全体 / キャラ / 関係のタブを追加

最小変更:

- `全体`
- `キャラ1`
- `キャラ2`
- `キャラ3`
- `関係・構図`
- `ネガティブ`

各キャラタブ内では、既存のタグ追加 UI を使い回す。

### Step 2: キャラブロック専用の scoped cluster preview

各キャラの入力から、以下の scoped cluster を自動生成してプレビューする。

```text
Left girl: eating ice cream, ice cream.
```

ユーザーが必要なら直接編集できる。無理に流暢な英文へ変換しない。

### Step 3: count tag 自動生成

キャラブロックの role から `1boy`, `2girls` などを生成する。

ただし自動生成が不確実な場合は警告に留める。

### Step 4: 既存 slot との互換

`version: "2.0.0"` の JSON を読み込む場合、既存 slot の内容は一括で `メイン` に移す。

既存 slot の中に自然文らしい文字列や `left girl` 風の疑似構文があっても、自動で `キャラ1〜X` へ分配しない。どのタグや phrase がどのキャラに属するかを JSON から確定できないため、読み込み時の再分類はしない。

明確な free text フィールドがある場合だけ `自然言語` に移す。明確な negative フィールドがある場合だけ `ネガティブ` に移す。それ以外の positive / slot 内容は `メイン` に集約する。

読み込み時に、character block への手動分解を提案する warning は出さない。移行 import は判断を入れず、一括移動だけを行う。

### Step 5: v2.1.0 として保存

キャラブロック対応後の保存 JSON は `version: "2.1.0"` とする。

`version: "2.0.0"` を読み込んだ場合も、保存時は `version: "2.1.0"` として新構造で出力する。

保存する主要ブロック:

- `main`: 画像全体にかかる positive パーツ。
- `characters`: キャラ1〜X の配列。
- `naturalLanguage`: 関係 caption 用の自由テキスト。
- `negative`: negative パーツ。

`characters[]` は role / position / appearance / outfit / expression / action / item / other を持つ。キャラごとの scoped cluster は保存時の文字列ではなく、この構造から生成する。

`enabled=false` のキャラも保存 JSON には残す。出力時だけ scoped cluster と count tag 生成から除外する。

final prompt 文字列そのものは正本として保存しない。保存 JSON は編集可能な構造を正本にし、final prompt は preview / export 時に生成する。

## 8. Lint / warning

追加したい warning:

- キャラブロックに role がない。
- キャラブロックに position がない。

## 9. 優先度

P0:

- 全体ブロックとキャラ1-3ブロックを導入。
- 各キャラに role / position / outfit / action / item / freeText を持たせる。
- 最終出力を「全体タグ + キャラ別 scoped cluster + 関係 caption」にする。
- 実際に backend へ渡る final prompt preview を表示する。

P1:

- count tag 自動生成。
- キャラ別 scoped cluster preview。
- 疑似構文 lint。

P2:

- CharacterBlock を既存ライブラリと深く統合。
- 複数キャラの関係テンプレート。
- character / series / appearance の辞書補助。

## 10. 設計上の注意

- キャラブロックの中身を最終的に全部タグへ平坦化しない。平坦化すると元の問題に戻る。
- キャラ別 scoped cluster と自然文 caption は Anima 仕様に反しない。Anima はタグと自然言語の混在を学習している。
- キャラ数は固定3だけにしない。デフォルト3、追加可能がよい。
- 既存の自由記述欄は残すが、複数キャラの属性を書く場所としてはキャラブロックへ誘導する。
- tag weight はキャラブロック内でも使えるが、複数キャラ構図ではキャラ固有 action / item を裸の global weighted tag として出すと他キャラへ漏れる可能性がある。

## 11. 使い分けの結論

すべての prompt をキャラブロックへ押し込む必要はない。むしろ、構図の複雑さに応じて編集方法を切り替えるのがよい。

### 軽い絵: 既存タグ UI で十分

例:

```text
1girl, school uniform, smiling, classroom
```

この程度なら、従来のタグ選択 UI が最も速い。キャラブロックや長い自然文 caption を使うと、かえって入力が重くなる。

### 中くらいの絵: キャラブロックが効く

例:

```text
中央に黒い服の男、左に少女、右に少女。
左の少女はアイスを食べている。
右の少女は網を持っている。
```

キャラブロック:

```text
キャラ1: role=man, position=center, outfit=black clothes
キャラ2: role=girl, position=left, action=eating ice cream, item=ice cream
キャラ3: role=girl, position=right, action=holding a net, item=net
関係: The two girls stand on either side of the man.
```

Final positive prompt:

```text
masterpiece, best quality, score_7, safe, 1boy, 2girls, anime illustration

Center man: black clothes, standing.
Left girl: eating ice cream, ice cream.
Right girl: holding a net, net.

The two girls stand on either side of the man.
```

この段階では、タグだけでは「誰の属性か」が混ざりやすい。キャラブロックで position / outfit / action / item を分けて保持し、最終出力ではキャラ別 scoped cluster と関係 caption にする。

### 複雑な絵: scoped cluster と関係 caption を主役にする

複数人の関係、視線、相互作用、前後関係、細かい動作が増えるほど、すべてをタグへ分解するのは難しくなる。

この場合は、キャラブロックを「完全なタグ化のための仕組み」ではなく、**キャラ別 scoped cluster と関係 caption を破綻させないための中間構造**として使う。

```text
masterpiece, best quality, score_7, safe, 1boy, 2girls, anime illustration

Center man: black clothes, standing.
Left girl: eating ice cream, ice cream, crying, tears, open mouth.
Right girl: holding a net, net, smile.

The two girls stand on either side of the man.
```

つまり、複雑な絵ほど「全体タグ列を増やす」のではなく、「最低限の強い全体タグ + キャラ別 scoped cluster + 正確な関係 caption」に寄せる。

## 12. キャラブロックの役割

キャラブロックは、精密な scene DSL を作るためのものではない。

主目的:

- 誰の外見か
- 誰の服装か
- 誰の行動か
- 誰の持ち物か
- 誰がどこにいるか
- キャラ同士がどう関係しているか

を人間とアプリが見失わないようにすること。

最終的な Anima prompt では、キャラブロックの情報を以下に変換する。

- count / quality / style などはタグ列
- キャラごとの属性や動作は scoped cluster
- 関係や構図は自然文 caption
- 明確な Danbooru / Gelbooru タグとして強いものだけタグ列にも出す

この考え方にすると、キャラブロックは巨大で重い編集システムではなく、「複数キャラの属性を混ぜないための整理箱」になる。

## 13. 強度調整のタイミング

人間が強度を調整するなら、完成した prompt 文字列を直接編集する前ではなく、キャラブロックから Anima prompt へ変換する直前がよい。

ただし、複数キャラ構図では注意が必要。`(eating ice cream:1.25)` をメインタグ列へ出すと、それは「左の少女の行動」ではなく「画像全体で強い概念」になり、他キャラにも漏れる可能性がある。

推奨する強度階層:

1. ブロック強度
   - 全体の画風を強める / 弱める
   - キャラ2の行動を強める
   - 背景を弱める

2. 個別タグ強度
   - `black clothes: 1.2`
   - `eating ice cream: 1.25`
   - `holding a net: 1.25`

複数キャラ構図の action / item weight は、デフォルトでは global tag として出さない。出す場合は scoped phrase に寄せる。

通常:

```text
Left girl: eating ice cream, ice cream.
```

強調候補:

```text
Left girl: (eating ice cream:1.15), ice cream.
```

実測上は、キャラ別 scoped cluster 内に強調構文を置く形は有効に働くことがある。

```text
Left girl: eating ice cream, ice cream, crying, screaming, (tears:1.5), open mouth.
```

この場合、`tears` は global tag ではなく `Left girl` の属性束の中にあるため、左少女へ寄る可能性が高まる。ただし完全な領域拘束ではない。

scoped cluster 内の weight と literal parentheses escape は混同しない。

- `(tears:1.5)` は ComfyUI / Forge Neo の weight 構文。
- `@null \(nyanpyoun\)` は artist tag 内の literal parentheses escape。

または:

```text
(left girl eating ice cream:1.15)
```

ただし、どちらも左少女だけに完全に効く保証はない。PromptEdit は warning を出し、最終 prompt preview で実際に渡る文字列を見せる。通常 UI の weight 範囲は控えめにし、極端な値は詳細設定または直接入力扱いにする。

行動系の「強く」は、注目度を上げたいのか、動作量や見た目を変えたいのかが分かれやすい。プログラムが `clearly eating` のように勝手に言い換えない。動作量を変える場合は、ユーザーが `holding the ice cream close to her mouth` や `taking a big bite` のような detail phrase を明示する。

この形なら、人間は完成 prompt の文字列を壊さず、意味単位で強度を調整できる。

## 14. 実装を重くしすぎないための境界

やる:

- 全体 / キャラ / 関係 / ネガティブを分ける。
- キャラごとに position / outfit / action / item / freeText を持つ。
- 最終出力は全体タグ列 + キャラ別 scoped cluster + 関係 caption にする。
- 複数キャラの属性が全体タグに混ざっている場合は warning を出す。
- ComfyUI / Forge Neo 向け final prompt では、artist tag などに含まれるリテラルな括弧を `\(name\)` のように escape する。

やりすぎ注意:

- すべての自然文をタグへ分解しようとする。
- キャラ同士の関係を過度に細かい独自 DSL にする。
- キャラ固有 action / item を無条件に global weighted tag として出す。
- 既存の単純なタグ編集までキャラブロック必須にする。
- すべての構図を UI 部品だけで表現しようとする。

設計の芯は、単純なものはタグで速く、複雑なものはキャラブロックを足場に自然文で正確に、という使い分け。
