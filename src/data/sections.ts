// ============================================================
//  Anima プロンプトのセクション定義 (§11)
// ============================================================
//  - 各スロット (positive / negative) は固定セクションで構成
//  - カテゴリ ID → セクション ID のマッピングを保持
// ============================================================

export const SECTION_IDS = [
    'quality',
    'people',
    'character',
    'series',
    'artist',
    'style',
    'camera',
    'background',
    'lighting',
    'other',
] as const
export type SectionId = typeof SECTION_IDS[number]

export const SECTION_LABELS: Record<SectionId, string> = {
    quality: '品質 / メタ / 年代 / レーティング',
    people: '人数・性別',
    character: 'キャラクター',
    series: 'シリーズ',
    artist: 'アーティスト',
    style: 'スタイル',
    camera: 'カメラ・構図',
    background: '背景',
    lighting: 'ライティング',
    other: 'その他',
}

/** defaultData.ts のカテゴリ ID → セクション ID マッピング */
export const CATEGORY_TO_SECTION: Record<string, SectionId> = {
    mc_unclassified: 'other',
    mc_quality: 'quality',
    mc_meta: 'quality',
    mc_artist: 'artist',
    mc_copyright: 'series',
    mc_people_gender: 'people',
    mc_composition: 'camera',
    mc_body_skin: 'other',
    mc_breast: 'other',
    mc_hair: 'other',
    mc_face: 'other',
    mc_eye: 'other',
    mc_expression: 'other',
    mc_base_pose: 'other',
    mc_action: 'other',
    mc_tops: 'other',
    mc_bottoms: 'other',
    mc_full_body_outfit: 'other',
    mc_swimsuit: 'other',
    mc_socks_shoes: 'other',
    mc_accessories: 'other',
    mc_gloves: 'other',
    mc_item: 'other',
    mc_kemonomimi: 'other',
    mc_monster: 'other',
    mc_indoor_bg: 'background',
    mc_outdoor: 'background',
    mc_weather: 'lighting',
    mc_effect: 'other',
    mc_nsfw: 'other',
}

/** categoryId からセクション ID を解決。未定義なら 'other' */
export function resolveSection(categoryId: string): SectionId {
    return CATEGORY_TO_SECTION[categoryId] ?? 'other'
}

/**
 * categoryId とタグ表記からセクション ID を解決。
 * 旧保存データ互換のため `character` セクション型は残すが、新規追加は series へ寄せる。
 */
export function resolveSectionForTag(categoryId: string, rawTag: string = ''): SectionId {
    void rawTag
    return resolveSection(categoryId)
}

/** 空のセクション Record を生成する */
export function emptySectionsRecord<T>(): Record<SectionId, T[]> {
    return {
        quality: [],
        people: [],
        character: [],
        series: [],
        artist: [],
        style: [],
        camera: [],
        background: [],
        lighting: [],
        other: [],
    }
}
