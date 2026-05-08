# Fatal App Discrepancies Against Anima Prompt Spec

調査日: 2026-05-08 JST

対象:

- `src/utils/promptGenerator.ts`
- `src/utils/dictionaryService.ts`
- `src/data/migrations/v2_0_0.ts`
- `src/data/sections.ts`
- 関連する入力 UI / import 経路

結論: 既存実装は Anima 化の大枠、つまり positive / negative 単一スロット、dataset tag、rating、artist `@`、公式タグ順に近いセクション出力はかなり入っている。致命的に危ないのは「タグ正規化が仕様と出力で一貫していない」点。次点で、キャラクターとシリーズを自動分類できない構造が、複数キャラや版権キャラの追従性を大きく落とす。

## P0: score タグを壊す正規化と、出力直前の正規化不足

### 現状

`src/utils/dictionaryService.ts` の `normalizeTagForAnima()` はすべての `_` を space に変換する。

```ts
return unescaped
    .replace(/_/g, ' ')
    .replace(/[()[\]:]/g, '\\$&')
```

しかし Anima 公式仕様では、通常タグは space 区切りだが、score tags だけは `score_1` から `score_9` のように underscore を使う。つまりこの実装は `score_7` を `score 7` に壊す。

さらに `src/utils/promptGenerator.ts` は `master.values.anima` をほぼそのまま最終出力へ渡す。

```ts
tag = master ? master.values.anima : ''
tag = tag.replace(/[\s,]+$/, '').trim()
return formatByWeight(tag, p.weight)
```

このため、手入力、編集、AI import、V1 migration、PNG import のどこかで Anima 仕様外の文字列が入ると、最終 prompt までそのまま流れる。

### なぜ致命的か

Anima の推奨 prefix は `masterpiece, best quality, score_7, safe`。品質制御の中核である `score_7` を `score 7` にすると、モデルが期待する quality tag ではなくなる可能性が高い。これは単なる表記ゆれではなく、品質・安全・年代などの上流タグを壊す問題。

また、V1 migration は `values.novelai` を `values.anima` にコピーするだけなので、旧 NovelAI の `_` 区切り、`{tag}` / `[tag]` 強調、大小文字、旧辞書由来の表記が混ざったまま Anima に渡る。

### 修正方針

中央集約の正規化関数を作り、保存時と出力直前の両方で使う。

候補:

```ts
normalizeAnimaTagForStorage(raw: string): string
normalizeAnimaTagForOutput(raw: string, sectionId?: SectionId): string
```

最低条件:

- 通常タグは lowercase。
- 通常タグの `_` は space に変換。
- `score_[1-9]` は underscore を保持。
- 派生モデルで使うなら `score_[1-9]_up` も保持対象にするか、lint で要確認にする。
- `year_2025` は `year 2025` に変換。
- artist section は `@` を出力時に補う。
- NovelAI の `{tag}` / `[tag]` / `||a|b||` は migration 時にそのまま通さず、変換または警告対象にする。
- `freeText` はタグ正規化と別扱いにする。自然文まで lowercase 化しない。

適用箇所:

- `store.addPart()`
- `store.updatePart()`
- `mergeAIImport()`
- `extractPNGMetadata()`
- `migrateV1ToV2()`
- `generatePromptFromSlot()` の出力直前
- `DictionaryAddTab.vue` / `ManualAddTab.vue` / `EditMasterPartModal.vue` の suggestion 選択時

## P0: V1 migration が NovelAI 文字列を Anima タグとして無検査で昇格する

### 現状

`src/data/migrations/v2_0_0.ts` は旧 `values.novelai` をそのまま `values.anima` へ移す。

```ts
anima: p.values.anima ?? p.values.novelai ?? ''
```

既存ドキュメントでは「タグ文字列自体の自動変換は行わない」方針になっているが、アプリとしては移行後の値を Anima タグとして扱ってコピー可能な最終 prompt に出してしまう。

### なぜ致命的か

旧データに NovelAI 強調構文、underscore タグ、NovelAI 向け boilerplate、Anima で意味を持たない randomizer 表記が含まれている場合、そのまま Anima prompt になる。ユーザーは「移行済み」と見えるのに、実際は Anima 仕様外の prompt を生成する。

### 修正方針

V1 migration は「無変換コピー」ではなく、少なくとも以下のどちらかにする。

1. 安全変換:
   - `_` を space 化。ただし score tags は保持。
   - `{tag}` / `[tag]` を裸タグに戻す。
   - 明らかな NovelAI 固有構文は削除または `freeText` / warning に逃がす。

2. 明示警告:
   - `migrationWarnings` のようなフィールドまたは import 結果 UI を追加。
   - 「旧 NovelAI タグを未検証の Anima タグとして取り込みました」と見せる。
   - コピー前 lint で止める。

実装上は 1 と 2 の併用がよい。完全自動変換に失敗するタグもあるため、変換したうえで warning を出す。

## P1: character と series を自動分類できないため、版権キャラ prompt が混線しやすい

### 現状

`src/data/sections.ts` には `character` セクションがあるが、既存カテゴリの `mc_copyright` は `series` に割り当てられている。

```ts
export const SECTION_IDS = ['quality', 'people', 'character', 'series', 'artist', 'other'] as const
...
mc_copyright: 'series',
```

一方、`defaultData.ts` のカテゴリ名は `版権・キャラクター` で、キャラクターとシリーズが同じカテゴリにいる。辞書や PNG import で categoryId 起点に section 解決すると、キャラクタータグまで `series` 扱いになりやすい。

### なぜ重大か

Anima 公式のタグ順は `[character] [series]` を分けている。また自然文 tips では、キャラクター名だけでなく基本外見を書くこと、複数キャラクターでは特に混乱しやすいことが明記されている。

キャラクターとシリーズを同じカテゴリで扱うと、PromptEdit が「キャラクター単位の意図」を持てない。単独キャラでは破綻しないこともあるが、複数キャラ、版権キャラ、キャラ別衣装・表情を扱うと追従性が大きく落ちる。

### 修正方針

短期:

- `character` と `series` をカテゴリまたは part metadata として分離する。
- AI import schema では `section: 'character' | 'series'` を必須寄りにする。
- PNG import / dictionary import では、categoryId だけでなく tag type を見て section を決める。

中期:

- `CharacterBlock` を導入する。

```ts
type CharacterBlock = {
  character: string
  series?: string
  appearanceTags: string[]
  outfitTags: string[]
  poseTags: string[]
  relationText?: string
}
```

最終出力は Anima の公式タグ順に並べるが、編集モデルとしてはキャラクターごとに appearance / outfit / pose を束ねる。これは複数キャラ追従性のための構造修正であり、単なる UI 改善ではない。

## 今回は致命扱いしないもの

- dataset tag の専用フィールド化: 実装済みで、公式仕様と大きな齟齬はない。
- rating の排他 UI: 公式の明示仕様ではないが、実用上は妥当。
- artist `@` 自動付与: 実装済みで、公式仕様と合っている。
- randomizer のクライアント側展開: Anima に randomizer 構文がない前提では妥当。
- PNG import の workflow 対応範囲: 実測サンプル不足のリスクはあるが、prompt 生成そのものの致命傷ではない。
