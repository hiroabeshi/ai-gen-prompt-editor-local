# Anima Prompt Research: Fact-check Claims

調査日: 2026-05-08 JST

別AIにファクトチェックしてもらうため、主張を小さく分けて記録する。

## 出典一覧

| ID | 出典 | URL | 備考 |
|---|---|---|---|
| S1 | Anima official Hugging Face | https://huggingface.co/circlestone-labs/Anima | 最優先の公式モデルカード |
| S2 | Anima official Civitai | https://civitai.com/models/2458426/anima-official?modelVersionId=2836417 | 公式Civitaiページ。2026-05-08調査時点で Updated: 2026-05-06。調査時のクロールは `civitai.red` ミラー経由。 |
| S3 | Danbooru tag groups | https://danbooru.donmai.us/wiki_pages/tag_groups | Danbooru タグ探索用 |
| S4 | Gelbooru help / posts | https://gelbooru.com/index.php?page=help&topic=post | Gelbooru のタグ種別説明 |

## 要ファクトチェック主張

| ID | 主張 | 出典 | 信頼度 | 確認メモ |
|---|---|---|---|---|
| C01 | Anima は CircleStone Labs と Comfy Org の共同による 2B パラメータ text-to-image モデル。 | S1, S2 | 高 | 公式モデルカードに記載。 |
| C02 | Anima は主に anime concepts, characters, styles 向けで、写実生成は得意ではない。 | S1, S2 | 高 | Limitations にも realism が苦手と記載。 |
| C03 | 学習データは数百万枚の anime images と約80万枚の non-anime artistic images。synthetic data は使っていない。 | S1, S2 | 高 | 公式モデルカード記載。 |
| C04 | anime training data の knowledge cut-off は 2025-09。 | S1, S2 | 高 | 公式モデルカード記載。 |
| C05 | 2026-05-08 調査時点で公式配布の中心は `preview3-base`。 | S1, S2 | 中 | Civitai は preview3-base を表示。HF も Preview3 セクションあり。将来更新されやすい。 |
| C06 | Anima は ComfyUI に native support され、diffusion model / text encoder / VAE をそれぞれ所定フォルダへ置く。 | S1, S2 | 高 | 公式インストール欄に記載。 |
| C07 | 使用ファイルは `anima-preview3-base.safetensors`, `qwen_3_06b_base.safetensors`, `qwen_image_vae.safetensors`。 | S1, S2 | 高 | 公式インストール欄に記載。 |
| C08 | 推奨解像度は約1MPで、例は `1024x1024`, `896x1152`, `1152x896`。 | S1, S2 | 高 | 公式 generation settings に記載。 |
| C09 | 推奨 steps は `30-50`。 | S1, S2 | 高 | 両出典で一致。 |
| C10 | 推奨 CFG は Hugging Face では `4-5`、Civitai では `4-6`。 | S1, S2 | 高 | 出典間差分として扱う。 |
| C11 | 例示 sampler は `er_sde`, `euler_a`, `dpmpp_2m_sde_gpu`。 | S1, S2 | 高 | 公式 generation settings に記載。 |
| C12 | Anima は Danbooru-style tags、natural language captions、その混在で学習されている。 | S1, S2 | 高 | Prompting セクションに記載。 |
| C13 | タグは lowercase、space 区切りを使い、score tags だけ underscore を使う。 | S1, S2 | 高 | Prompting セクションに記載。 |
| C14 | Danbooru と Gelbooru でタグ差分がある場合、Gelbooru 版を優先する。 | S1, S2 | 高 | Prompting セクションに記載。 |
| C15 | 公式推奨 positive prefix は `masterpiece, best quality, score_7, safe,`。 | S1, S2 | 高 | Prompting セクションに記載。 |
| C16 | 公式推奨 negative は `worst quality, low quality, score_1, score_2, score_3, artist name`。 | S1, S2 | 高 | Prompting セクションに記載。 |
| C17 | 公式タグ順は `[quality/meta/year/safety tags] [1girl/1boy/1other etc] [character] [series] [artist] [general tags]`。 | S1, S2 | 高 | Tag order セクションに記載。 |
| C18 | 同一タグセクション内の順序は任意。 | S1, S2 | 高 | Tag order セクションに記載。 |
| C19 | quality tags には human score 系と PonyV7 aesthetic score 系がある。 | S1, S2 | 高 | Quality tags セクションに記載。 |
| C20 | time period tags は `year 2025` などの年指定と `newest`, `recent`, `mid`, `early`, `old`。 | S1, S2 | 高 | Time period tags セクションに記載。 |
| C21 | safety tags は `safe`, `sensitive`, `nsfw`, `explicit`。 | S1, S2 | 高 | Safety tags セクションに記載。 |
| C22 | artist tag は `@` prefix が必要で、付けないと効果が弱い。 | S1, S2 | 高 | Artist tags セクションに記載。 |
| C23 | Anima は random tag dropout で学習されており、関連タグをすべて入れる必要はない。 | S1, S2 | 高 | Tag dropout セクションに記載。 |
| C24 | 非アニメ系データセット用の dataset tag として `ye-pop` と `deviantart` の例があり、prompt 先頭に改行区切りで置く。 | S1, S2 | 高 | Dataset tags セクションに記載。 |
| C25 | 純自然文 prompt は詳しいほうがよく、最低2文程度が推奨される。 | S1, S2 | 高 | Natural language prompting tips に記載。 |
| C26 | キャラクター指定時は名前に加えて基本外見を説明することが重要で、複数キャラクターでは特に重要。 | S1, S2 | 高 | Natural language prompting tips に記載。 |
| C27 | Anima はテキスト描画が苦手で、長い文字列のレンダリングは難しい。 | S1, S2 | 高 | Limitations に記載。 |
| C28 | preview model は 2MP 付近から破綻しやすい。 | S1, S2 | 高 | Limitations に記載。 |
| C29 | Anima base は aesthetic tuning 済みではなく、quality / artist tag なしでは neutral / plain になりやすい。 | S1, S2 | 高 | Limitations に記載。 |
| C30 | Anima と derivative model は CircleStone Labs Non-Commercial License により非商用利用のみ。 | S1, S2 | 高 | License セクションに記載。 |
| C31 | このプロジェクトでは、Anima 派生モデル利用のため Danbooru tags は効く前提。 | ユーザー指示 | プロジェクト前提 | 公式事実ではなく、今回の実装前提。 |
| C32 | safety tag を UI で排他選択にする。 | 実装判断 | 中 | 公式の列挙をもとにした PromptEdit 側判断。公式が排他と明記したわけではない。 |
| C33 | `(tag:1.2)` weight は Anima モデル仕様ではなく ComfyUI adapter 側の構文として扱う。 | S1, 既存設計 | 中 | Anima 公式モデルカードには weight 構文の明記なし。ComfyUI 出力では別途確認が必要。 |
| C34 | NovelAI 由来の randomizer 構文は Anima モデル仕様ではないため、クライアント側で展開する。 | S1, 既存設計 | 中 | 公式モデルカードに randomizer 構文の記載なし。 |

## 出典間の差分

- CFG: Hugging Face は `4-5`、Civitai は `4-6`。実装資料では両方を併記し、デフォルト値を置く場合は `4-5` を保守寄りに扱う。
- Civitai は 2026-05-08 調査時点で Updated: 2026-05-06。Hugging Face 側も今後更新される可能性があるため、実装着手前に再確認する。

## 追加で確認したいこと

- 使用予定の Anima 派生モデルが official Anima と同じ tokenizer / prompt semantics をどの程度保っているか。
- 派生モデル側で推奨される positive / negative prefix が official と違うか。
- Gelbooru 優先の具体的な alias 辞書をどこから取るか。
- ComfyUI workflow PNG で positive / negative prompt がどのノードに格納されるか。
- `score_7_up` のような派生 score tag を許容するか。公式 Anima の記述は `score_9` から `score_1` 形式が中心。
