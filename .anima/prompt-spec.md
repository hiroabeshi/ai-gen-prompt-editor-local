# Anima Prompt Spec Notes

調査日: 2026-05-08 JST

## 1. モデル前提

Anima は CircleStone Labs と Comfy Org の共同による 2B パラメータの text-to-image モデル。公式モデルカードでは、アニメ系の概念、キャラクター、スタイルを主対象にしつつ、非写実的なイラストやアートにも対応すると説明されている。写実寄りの生成は得意ではない。

公式情報では、数百万枚規模のアニメ画像と約80万枚の非アニメ系アート画像で学習され、アニメ学習データの knowledge cut-off は 2025-09 とされている。2026-05-08 時点で参照した公式配布は `preview3-base`。

このプロジェクトではユーザー指示により、Anima 派生モデルを使うため Danbooru タグが効く前提で実装する。ただし Anima 公式は Danbooru-style tags だけでなく自然言語キャプションも学習対象としているため、タグ列と自然文の混在を第一級の入力として扱う。

## 2. プロンプト入力形式

Anima は以下を学習しているとされる。

- Danbooru-style tags
- natural language captions
- タグと自然言語キャプションの混在

実装上は「タグだけに正規化して自然文を消す」のではなく、構造化タグ領域と自由記述領域を分けて保持する。

## 3. タグの正規化

公式モデルカード上のタグ正規化ルール:

- タグは lowercase を使う。
- アンダースコアではなく space 区切りを使う。
- 例外として、`score_1` から `score_9` のような score タグはアンダースコアを使う。
- Danbooru と Gelbooru でタグ表記が違う場合は Gelbooru 版を優先する。

PromptEdit 側の推奨正規化:

- `long_hair` は `long hair` に変換する。
- `score_7` は `score_7` のまま保持する。
- `year 2025` のようなスペース込みタグを壊さない。
- `@artist name` の `@` は保持する。
- ハイフンや記号を機械的に削らない。公式例にも `fur-trimmed gloves` のようなハイフン付き語がある。

## 4. 推奨タグ順

公式モデルカードのタグ順:

```text
[quality/meta/year/safety tags] [1girl/1boy/1other etc] [character] [series] [artist] [general tags]
```

同一セクション内の順序は任意とされている。PromptEdit では、セクション順は自動整列し、セクション内はユーザーの並び順を維持するのがよい。

## 5. Quality tags

公式が挙げている human score 系:

- `masterpiece`
- `best quality`
- `good quality`
- `normal quality`
- `low quality`
- `worst quality`

公式が挙げている PonyV7 aesthetic score 系:

- `score_9`
- `score_8`
- ...
- `score_1`

公式モデルカードでは、human score 系、score 系、その両方、またはどちらも使わない構成が可能とされている。

推奨 positive prefix:

```text
masterpiece, best quality, score_7, safe,
```

推奨 negative:

```text
worst quality, low quality, score_1, score_2, score_3, artist name
```

`safe` は用途に応じて `sensitive` / `nsfw` / `explicit` へ置き換える。

## 6. Time period tags

公式が挙げている time period tags:

- Specific year: `year 2025`, `year 2024`, ...
- Period: `newest`, `recent`, `mid`, `early`, `old`

PromptEdit では、年タグと period タグを同時に複数入れると意図が曖昧になりやすいため、lint で警告する。

## 7. Meta tags

公式例:

- `highres`
- `absurdres`
- `anime screenshot`
- `jpeg artifacts`
- `official art`

Meta tags は画質、出典風、画像状態に関わるため、general tags と混ぜず `quality/meta/year/safety` セクションに置く。

## 8. Safety tags

公式が挙げている safety tags:

- `safe`
- `sensitive`
- `nsfw`
- `explicit`

公式は「適切な safety tags を positive / negative に使う」ことを推奨している。PromptEdit 側では、実用上の曖昧さを減らすため positive 側の safety tag を 1 つ選択する専用 UI として扱う。

## 9. Artist tags

公式ルール:

- artist tag は `@` を先頭につける。
- `@` を付けない場合、効果がかなり弱くなる。

PromptEdit 側:

- artist セクションのタグは出力時に `@` を自動付与する。
- negative 側の `artist name` は「アーティスト名風のノイズ抑制」用の一般 negative として別扱いにする。

## 10. Character / series tags

公式の natural language tips では、キャラクター名だけでなく基本外見も説明することが重要とされている。特に複数キャラクターでは、名前だけを列挙すると混乱しやすい。

PromptEdit 側:

- character と series は専用セクションで持つ。
- キャラクターに紐づく外見タグを一緒に保存できる構造が望ましい。
- 複数キャラクターでは、各キャラクターごとに appearance tags / outfit / pose を束ねられると追従性が上がる。

## 11. General tags

表情、髪型、服装、構図、背景、照明、オブジェクトなどの通常タグは general tags として扱う。

Danbooru tag groups はタグ探索の入口として使える。ただし Anima 公式は、Danbooru と Gelbooru で表記差がある場合は Gelbooru 版を優先するとしているため、辞書は alias を持てる構造にしておく。

## 12. Tag dropout

公式では、Anima は random tag dropout で学習されているため、画像に関係するすべてのタグを含める必要はないとされている。

実装上は、タグ数を増やしすぎるよりも、意図の強いタグをセクション順に整理することを優先する。大量タグの羅列には「高優先タグ」と「補助タグ」の区別を付けるとよい。

## 13. Dataset tags

公式によると、Anima には LAION-POP の `ye-pop` と DeviantArt 由来の非アニメ系データも含まれ、これらは dataset tag で区別されている。dataset tag はプロンプトの最初に置き、改行で本文と区切る。

形式:

```text
deviantart
Digital painting of ...
```

または:

```text
ye-pop
Image alt text or title
Description...
```

PromptEdit 側:

- dataset tag はカンマ区切りタグ列に混ぜない。
- positive prompt の先頭に出力する専用フィールドにする。
- 通常のアニメ生成では空欄がデフォルト。

## 14. Natural language prompting

公式 tips:

- キャラクター名やシリーズ名は標準的な英語の capitalization に従う。
- 純粋な自然文の場合、短すぎるプロンプトは予期しない結果になりやすいため、最低2文程度を目安に詳しく書く。
- タグと自然文は任意の順序で混在できる。
- quality / artist tags を自然文プロンプトの先頭に置ける。
- キャラクターを指定する場合、キャラクター名に加えて基本外見を説明する。

PromptEdit 側:

- free text 欄は削らず保持する。
- 純自然文が短すぎる場合は警告する。
- キャラクター名だけの入力には appearance 補完の導線を出す。

## 15. Generation settings

PromptEdit は主にプロンプト編集ツールだが、実装判断や PNG メタ解析時の参考として記録する。

Hugging Face 公式モデルカード:

- 1MP 程度の解像度を推奨。
- 例: `1024x1024`, `896x1152`, `1152x896`
- steps: `30-50`
- CFG: `4-5`
- sampler examples: `er_sde`, `euler_a`, `dpmpp_2m_sde_gpu`

Civitai 公式ページ:

- 1MP 程度の解像度を推奨。
- steps: `30-50`
- CFG: `4-6`
- sampler examples は Hugging Face と同系統。

CFG の上限だけ出典間で差があるため、PromptEdit の資料では `4-5` を公式HF基準、`4-6` を公式Civitai基準として併記する。

## 16. Limitations

公式が挙げている制限:

- 写実は得意ではない。
- 短い、または詳細不足のプロンプトでは望まない内容が出ることがある。
- テキスト描画は苦手で、長文テキストは特に難しい。
- preview model は 2MP 付近から破綻しやすい。
- base model は aesthetic tuning 済みではないため、quality / artist tag がないとデフォルトが平坦になりやすい。

PromptEdit 側では、短すぎる prompt、空の quality、artist 不在、構造不足を lint で見える化すると追従性改善に効く。

## 17. 強調記法について

Anima 公式モデルカードには、プロンプト weight 構文の明示仕様は見当たらない。したがって `(tag:1.2)` のような重み付けは Anima の仕様ではなく、ComfyUI / WebUI など推論バックエンド側の構文として扱う。

PromptEdit 側:

- 出力先が ComfyUI の場合は `(tag:1.2)` 形式を使う。
- モデル仕様メモではなく backend adapter の責務として扱う。
- 重みは過度に上げず、UI では実用範囲を制限する。
- ComfyUI / Forge Neo 向け出力では、artist tag や character tag に含まれるリテラルな括弧を `\(name\)` のように escape する。未 escape の `()` は weight 構文として解釈される可能性がある。
