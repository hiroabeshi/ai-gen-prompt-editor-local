import type { AppState, CharacterPromptBlock, Slot } from '../types'
import { emptySectionsRecord } from './sections'

function makeEmptySlot(type: 'positive' | 'negative'): Slot {
    const base: Slot = {
        id: type === 'positive' ? 'slot_positive' : 'slot_negative',
        type,
        sections: emptySectionsRecord(),
        freeText: '',
    }
    if (type === 'positive') {
        base.datasetTag = ''
        base.rating = null
    }
    return base
}

function makeEmptyCharacter(index: number): CharacterPromptBlock {
    return {
        id: `character_${index}`,
        label: `キャラ${index}`,
        enabled: true,
        role: '',
        position: '',
        customPosition: '',
        character: [],
        appearance: [],
        outfit: [],
        expression: [],
        action: [],
        item: [],
        other: [],
    }
}

export const defaultData: AppState = {
    version: '2.1.0',
    categories: [
        // §9.3 決定: NovelAI 時代の categories は維持（CATEGORY_TO_SECTION マッピングが依存）
        { id: 'mc_unclassified', name: '未分類', color: '#808080' },
        { id: 'mc_quality', name: '画質・スタイル', color: '#6366F1' },
        { id: 'mc_meta', name: 'メタ・UI・文字', color: '#64748B' },
        { id: 'mc_artist', name: '作者・アーティスト', color: '#EC4899' },
        { id: 'mc_copyright', name: '版権・キャラクター', color: '#F43F5E' },
        { id: 'mc_people_gender', name: '人数・性別', color: '#10B981' },
        { id: 'mc_composition', name: '構図・アングル・視線', color: '#F97316' },
        { id: 'mc_body_skin', name: '体格・肌', color: '#14B8A6' },
        { id: 'mc_breast', name: '胸', color: '#06B6D4' },
        { id: 'mc_hair', name: '髪型・髪色・髪の長さ', color: '#8B5CF6' },
        { id: 'mc_face', name: '顔パーツ・特徴', color: '#A855F7' },
        { id: 'mc_eye', name: '目の色・形', color: '#3B82F6' },
        { id: 'mc_expression', name: '表情・メイク', color: '#EF4444' },
        { id: 'mc_base_pose', name: '基本ポーズ', color: '#F59E0B' },
        { id: 'mc_action', name: 'アクション・絡み', color: '#EAB308' },
        { id: 'mc_tops', name: 'トップス・アウター', color: '#D946EF' },
        { id: 'mc_bottoms', name: 'ボトムス・スカート', color: '#C026D3' },
        { id: 'mc_full_body_outfit', name: '全身服・制服・コスプレ', color: '#86198F' },
        { id: 'mc_swimsuit', name: '水着・下着', color: '#F72585' },
        { id: 'mc_socks_shoes', name: '靴下・脚周り・靴', color: '#4338CA' },
        { id: 'mc_accessories', name: '帽子・アクセサリー・装飾', color: '#0EA5E9' },
        { id: 'mc_gloves', name: '手袋・腕周り', color: '#0284C7' },
        { id: 'mc_item', name: '武器・小道具・食べ物', color: '#84CC16' },
        { id: 'mc_kemonomimi', name: '獣耳・尻尾・人外', color: '#A3E635' },
        { id: 'mc_monster', name: '動物・モンスター', color: '#E11D48' },
        { id: 'mc_indoor_bg', name: '屋内・建造物・背景', color: '#FCD34D' },
        { id: 'mc_outdoor', name: '自然・植物・屋外', color: '#22C55E' },
        { id: 'mc_weather', name: '天候・時間・光', color: '#06B6D4' },
        { id: 'mc_effect', name: 'エフェクト・体液', color: '#DB2777' },
        { id: 'mc_nsfw', name: 'NSFW（エロ・グロ）', color: '#DC2626' },
    ],
    // §9.3 決定: 初期 library は空。ユーザーが Anima 準拠のパーツを手作業で投入する。
    library: [],
    positive: makeEmptySlot('positive'),
    characters: [makeEmptyCharacter(1), makeEmptyCharacter(2), makeEmptyCharacter(3)],
    naturalLanguage: '',
    negative: makeEmptySlot('negative'),
}
