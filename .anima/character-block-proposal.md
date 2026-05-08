# Character Block Proposal for Anima PromptEdit

作成日: 2026-05-08 JST

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

最終出力は、Anima の特性に合わせて **タグ列 + 自然言語 caption** にする。

Anima 公式は Danbooru-style tags と natural language captions とその混在を学習しているため、キャラごとの紐づきはタグだけで無理に表現せず、自然文 caption を併用する。

## 3. 推奨 UI 構造

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

このブロックは既存の positive slot の `quality` / `other` の発展形。

### キャラブロック

デフォルトで `キャラ1` から `キャラ3` を用意する。必要に応じて追加可能にする。

各キャラブロックの項目:

| 項目 | 例 | 出力先 |
|---|---|---|
| role | man, girl, boy, woman | count / caption |
| position | center, left, right, foreground | caption |
| character name | Fern | character tag / caption |
| series | Sousou no Frieren | series tag / caption |
| appearance tags | long purple hair, purple eyes | tag / caption |
| outfit tags | black clothes, white dress | tag / caption |
| expression tags | smile, open mouth | tag / caption |
| pose / action tags | standing, eating ice cream | caption 優先 |
| held item / object | ice cream, net | caption 優先 |
| free text | slightly nervous, looking at the man | caption |

重要: キャラブロック内のタグは、最終出力で単純に全体タグへ混ぜるだけではなく、caption 生成時に「このキャラの属性」として文にする。

### 関係・構図ブロック

キャラ間の関係や全体配置を扱う。

- `Character 1 stands in the center.`
- `Character 2 is on his left.`
- `Character 3 is on his right.`
- `The two girls stand on either side of the man.`

タグだけでは弱い要素なので、自然言語 caption を主出力にする。

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

出力は 2 層にする。

1. Anima 公式順に近いタグ列
2. キャラ紐づき caption

例:

```text
masterpiece, best quality, score_7, safe, highres, 1boy, 2girls, anime illustration, soft lighting

A man wearing black clothes stands in the center. A girl on his left is eating ice cream. A girl on his right is holding a net. The two girls stand on either side of the man.
```

この形にすると、quality / style / count はタグで強く伝え、キャラごとの関係は自然文で明確に伝えられる。

### Character / series tags

版権キャラを使う場合、タグ列にも character / series を出す。

```text
masterpiece, best quality, score_7, safe, 1girl, fern, sousou no frieren

Digital artwork of Fern from Sousou no Frieren, with long purple hair and purple eyes, wearing ...
```

公式 tips と同じく、名前だけでなく基本外見を caption 側にも入れる。

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

A man wearing black clothes stands in the center. A girl on his left is eating ice cream. A girl on his right is holding a net. The two girls stand on either side of the man.
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

### Step 2: キャラブロック専用の caption preview

各キャラの入力から、以下の文を自動生成してプレビューする。

```text
A girl on the left is eating ice cream.
```

ユーザーが必要なら直接編集できる。

### Step 3: count tag 自動生成

キャラブロックの role から `1boy`, `2girls` などを生成する。

ただし自動生成が不確実な場合は警告に留める。

### Step 4: 既存 slot との互換

既存 positive slot のタグは `全体` に移す。

移行時に分類できるタグだけキャラブロックへ移すのは危険。誰の属性か判断できないため、既存データは全体側に置いておき、人間が必要に応じてキャラへ移す。

## 8. Lint / warning

追加したい warning:

- キャラが複数いるのに、全体ブロックに服装・行動・持ち物タグが大量にある。
- キャラブロックに role がない。
- キャラブロックに position がない。
- 版権キャラ名があるが appearance がない。
- キャラごとの item / action が空なのに relation text が複雑。
- `left girl:` のような疑似構文が freeText にある。キャラブロックへの分解を提案する。

## 9. 優先度

P0:

- 全体ブロックとキャラ1-3ブロックを導入。
- 各キャラに role / position / outfit / action / item / freeText を持たせる。
- 最終出力を「全体タグ + キャラ別 caption」にする。

P1:

- count tag 自動生成。
- キャラ別 caption preview。
- 疑似構文 lint。

P2:

- CharacterBlock を既存ライブラリと深く統合。
- 複数キャラの関係テンプレート。
- character / series / appearance の辞書補助。

## 10. 設計上の注意

- キャラブロックの中身を最終的に全部タグへ平坦化しない。平坦化すると元の問題に戻る。
- 自然文 caption は Anima 仕様に反しない。むしろ公式が推奨している使い方。
- キャラ数は固定3だけにしない。デフォルト3、追加可能がよい。
- 既存の自由記述欄は残すが、複数キャラの属性を書く場所としてはキャラブロックへ誘導する。
- tag weight はキャラブロック内でも使えるが、caption 文の中では重み記法を使わないほうが読みやすい。

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
中央に男、左に少女、右に少女。
左の少女はアイスを食べている。
右の少女は網を持っている。
```

この段階では、タグだけでは「誰の属性か」が混ざりやすい。キャラブロックで position / outfit / action / item を分けて保持し、最終出力ではキャラ別 caption にする。

### 複雑な絵: 自然言語 caption を主役にする

複数人の関係、視線、相互作用、前後関係、細かい動作が増えるほど、すべてをタグへ分解するのは難しくなる。

この場合は、キャラブロックを「完全なタグ化のための仕組み」ではなく、**自然言語 caption を破綻させないための中間構造**として使う。

```text
masterpiece, best quality, score_7, safe, 1boy, 2girls, anime illustration

A man wearing black clothes stands in the center. A girl on his left is eating ice cream. A girl on his right is holding an insect net. The two girls stand on either side of the man.
```

つまり、複雑な絵ほど「タグ列を増やす」のではなく、「最低限の強いタグ + 正確な自然文 caption」に寄せる。

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
- キャラごとの属性や動作は自然文 caption
- 関係や構図は自然文 caption
- 明確な Danbooru / Gelbooru タグとして強いものだけタグ列にも出す

この考え方にすると、キャラブロックは巨大で重い編集システムではなく、「複雑な自然文を安定して作るための整理箱」になる。

## 13. 強度調整のタイミング

人間が強度を調整するなら、完成した prompt 文字列を直接編集する前ではなく、キャラブロックから Anima prompt へ変換する直前がよい。

推奨する強度階層:

1. ブロック強度
   - 全体の画風を強める / 弱める
   - キャラ2の行動を強める
   - 背景を弱める

2. 個別タグ強度
   - `black clothes: 1.2`
   - `eating ice cream: 1.25`
   - `holding a net: 1.25`

caption では weight 記法を直接入れず、必要なら文の表現を強める。

通常:

```text
A girl on his left is eating ice cream.
```

強め:

```text
A girl on his left is clearly eating ice cream, holding the ice cream close to her mouth.
```

タグ側:

```text
(eating ice cream:1.25), ice cream
```

この形なら、人間は完成 prompt の文字列を壊さず、意味単位で強度を調整できる。

## 14. 実装を重くしすぎないための境界

やる:

- 全体 / キャラ / 関係 / ネガティブを分ける。
- キャラごとに position / outfit / action / item / freeText を持つ。
- 最終出力はタグ列 + 自然文 caption にする。
- 複数キャラの属性が全体タグに混ざっている場合は warning を出す。

やりすぎ注意:

- すべての自然文をタグへ分解しようとする。
- キャラ同士の関係を過度に細かい独自 DSL にする。
- weight を caption 文の内部に混ぜる。
- 既存の単純なタグ編集までキャラブロック必須にする。
- すべての構図を UI 部品だけで表現しようとする。

設計の芯は、単純なものはタグで速く、複雑なものはキャラブロックを足場に自然文で正確に、という使い分け。
