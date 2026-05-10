// ============================================================
//  型定義 (Anima 対応版)
// ============================================================

import type { SectionId } from '../data/sections'

export type PromptPart = {
    id: string;            // マスターID (UUIDv4)
    categoryId: string;    // カテゴリ参照用
    label: string;         // 表示名
    values: {
        anima: string;       // Anima 用タグ (ComfyUI 標準・スペース区切り・小文字)
    };
}

export const DEFAULT_PART_WEIGHT = 1.0;

export type Category = {
    id: string;            // カテゴリID (UUIDv4)
    name: string;
    color: string;         // カテゴリ識別カラー (例: "#F59E0B")
}

export type SelectedPart = {
    id: string;            // インスタンスID (UUIDv4, スロット内一意)
    partId: string;        // 参照元マスターID
    weight: number;
    enabled: boolean;
}

/** Anima レーティング（排他・positive のみ） */
export type Rating = 'safe' | 'sensitive' | 'nsfw' | 'explicit'

export const CHARACTER_FIELD_IDS = [
    'character',
    'appearance',
    'outfit',
    'expression',
    'action',
    'item',
    'other',
] as const

export type CharacterFieldId = typeof CHARACTER_FIELD_IDS[number]

export type CharacterPosition =
    | 'left'
    | 'center'
    | 'right'
    | 'top'
    | 'bottom'
    | 'foreground'
    | 'background'
    | 'custom'
    | ''

export type CharacterPromptBlock = {
    id: string
    label: string
    enabled: boolean
    role: string
    position: CharacterPosition
    customPosition?: string
    character: SelectedPart[]
    appearance: SelectedPart[]
    outfit: SelectedPart[]
    expression: SelectedPart[]
    action: SelectedPart[]
    item: SelectedPart[]
    other: SelectedPart[]
}

export type Slot = {
    id: string;                                     // スロットID
    type: 'positive' | 'negative';
    sections: Record<SectionId, SelectedPart[]>;    // 固定 6 セクション (ポジ/ネガ共通)
    freeText: string;                               // 自然言語入力欄 (ポジ/ネガ両方)
    datasetTag?: string;                            // Anima dataset tag (positive のみ使用)
    rating?: Rating | null;                         // レーティング (positive のみ使用)
}

export type AppState = {
    version: string;                 // '2.1.0' 以降
    categories: Category[];
    library: PromptPart[];
    positive: Slot;                  // 内部名。保存 JSON では main として出力する
    characters: CharacterPromptBlock[];
    naturalLanguage: string;         // 関係・構図 caption
    negative: Slot;                  // 単一ネガティブ
}

// ============================================================
//  AI インポート用スキーマ型
// ============================================================

export type AIImportPart = {
    label: string;
    values: { anima: string };
}

export type AIImportCategory = {
    name: string;
    parts: AIImportPart[];
}

/** AI インポート JSON のスロット表現
 *  - `section` を直接指定する新形式、または `categoryId` 起点で解決する既存形式の両対応。
 *  - ここでは最小限、名前だけ持つ軽量な構造とする。
 */
export type AIImportSlotPart = AIImportPart & {
    section?: SectionId
}

export type AIImportSlot = {
    type: 'positive' | 'negative';
    parts: AIImportSlotPart[];
    freeText?: string;
    datasetTag?: string;
    rating?: Rating | null;
}

export type AIImportData = {
    library: AIImportCategory[];
    slots: AIImportSlot[];
}

// ============================================================
//  ランダマイザ ユーティリティ
// ============================================================

/** ランダマイザ partId の固定プレフィックス */
export const RANDOMIZER_PREFIX = 'randomizer__'

/** partId がランダマイザかどうか判定する */
export function isRandomizerPartId(partId: string): boolean {
    return partId.startsWith(RANDOMIZER_PREFIX)
}

/** categoryId からランダマイザ用の固定 partId を生成する */
export function randomizerPartId(categoryId: string): string {
    return `${RANDOMIZER_PREFIX}${categoryId}`
}

/** ランダマイザ partId から categoryId を取り出す */
export function categoryIdFromRandomizer(partId: string): string {
    return partId.slice(RANDOMIZER_PREFIX.length)
}
