# Anima Prompt Research

調査日: 2026-05-08 JST

このフォルダは、PromptEdit の Anima 向けプロンプト追従性を高めるための調査メモ置き場です。

## ファイル

- [prompt-spec.md](prompt-spec.md): Anima 公式情報を中心にしたプロンプト仕様の要約。
- [implementation-rules.md](implementation-rules.md): PromptEdit 側へ落とす実装ルールとバリデーション方針。
- [fact-check-claims.md](fact-check-claims.md): 別AIで検証しやすいように、主張・出典・信頼度・要確認点を分解した表。

## 調査方針

- 公式の Hugging Face / Civitai モデルカードを最優先の出典にする。
- ユーザー追加指示により、このプロジェクトでは「Anima 派生モデルを使うため Danbooru タグは効く」ことを前提にする。
- ただし、Anima 公式では「Danbooru-style tags」と「自然言語キャプション」と「その混在」を学習していると説明されているため、実装上はタグ専用ではなく、タグと自然文の両方を扱う。
- 仕様と実装判断を分けて記録する。例えば、レーティングを UI で排他にすることは実装判断であり、公式の明示仕様そのものではない。

## 主要出典

- Anima official Hugging Face: https://huggingface.co/circlestone-labs/Anima
- Anima official Civitai: https://civitai.com/models/2458426/anima-official?modelVersionId=2836417
- Danbooru tag groups: https://danbooru.donmai.us/wiki_pages/tag_groups
- Gelbooru help / tag types: https://gelbooru.com/index.php?page=help&topic=post
