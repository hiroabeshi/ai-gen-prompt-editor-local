// ============================================================
//  辞書データサービス (dictionary.json)
//  - カテゴリ別タグ取得 (100件ページネーション)
//  - 日本語 / 英語サジェスト検索 (最大30件)
// ============================================================

import dictionaryRaw from '../data/json/dictionary.json'
import { normalizeAnimaTagForStorage } from './animaTagNormalization'

/** 辞書エントリ1件 */
export type DictEntry = {
    tag: string         // 英語タグ (= Anima タグ)
    label: string       // 日本語ラベル
    categoryIndex: number // categories 配列のインデックス
}

/** ページネーション結果 */
export type PageResult = {
    entries: DictEntry[]
    totalCount: number
    page: number
    pageSize: number
    totalPages: number
}

// ─── 初期化 ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dict = dictionaryRaw as any as {
    categories: string[]
    tags: Record<string, [string, number]>
}

/** 辞書カテゴリ一覧 (30件) */
export const dictCategories: string[] = dict.categories

// カテゴリ別にグルーピングしたキャッシュ
const entriesByCategory = new Map<number, DictEntry[]>()

// 全エントリ (サジェスト用)
const allEntries: DictEntry[] = []

    // 初回ロード時に一度だけ構築
    ; (function buildIndex() {
        for (const [tag, tuple] of Object.entries(dict.tags)) {
            const label = tuple[0] as string
            const catIdx = tuple[1] as number
            const entry: DictEntry = { tag, label, categoryIndex: catIdx }
            allEntries.push(entry)

            let arr = entriesByCategory.get(catIdx)
            if (!arr) {
                arr = []
                entriesByCategory.set(catIdx, arr)
            }
            arr.push(entry)
        }
    })()

// ─── タグ正規化 ────────────────────────────────────────────

/**
 * Danbooru 形式のタグを Anima プロンプト用に正規化する。
 * - 通常タグのアンダースコアはスペースに置換
 * - `score_7` / `score_7_up` 形式の score tag は保持
 * - 重み付け / ネスト構文の予約記号 `(`, `)`, `[`, `]`, `:` はバックスラッシュでエスケープ
 */
export function normalizeTagForAnima(tag: string): string {
    return normalizeAnimaTagForStorage(tag)
}

// ─── カテゴリ別タグ取得 (ページネーション) ─────────────────

/**
 * 指定カテゴリのタグを100件ずつ取得。
 * カテゴリ切り替え時に呼び直す想定。
 */
export function getTagsByCategory(
    categoryIndex: number,
    page: number = 1,
    pageSize: number = 100,
    query: string = ''
): PageResult {
    let entries = entriesByCategory.get(categoryIndex) ?? []

    if (query) {
        const q = query.toLowerCase()
        entries = entries.filter(e => e.label.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q))
    }

    const totalCount = entries.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const safePage = Math.max(1, Math.min(page, totalPages))
    const start = (safePage - 1) * pageSize
    const sliced = entries.slice(start, start + pageSize)

    return {
        entries: sliced,
        totalCount,
        page: safePage,
        pageSize,
        totalPages,
    }
}

// ─── サジェスト検索 ────────────────────────────────────────

/**
 * 日本語ラベルで前方一致 / 部分一致検索 (最大30件)
 */
export function suggestByLabel(query: string, limit: number = 30): DictEntry[] {
    if (!query) return []
    const q = query.toLowerCase()
    const results: DictEntry[] = []
    // 前方一致を優先
    for (const entry of allEntries) {
        if (entry.label.toLowerCase().startsWith(q)) {
            results.push(entry)
            if (results.length >= limit) return results
        }
    }
    // 部分一致で補完
    for (const entry of allEntries) {
        if (!entry.label.toLowerCase().startsWith(q) && entry.label.toLowerCase().includes(q)) {
            results.push(entry)
            if (results.length >= limit) return results
        }
    }
    return results
}

/**
 * 英語タグで前方一致 / 部分一致検索 (最大30件)
 */
export function suggestByTag(query: string, limit: number = 30): DictEntry[] {
    if (!query) return []
    const q = query.toLowerCase()
    const results: DictEntry[] = []
    for (const entry of allEntries) {
        if (entry.tag.toLowerCase().startsWith(q)) {
            results.push(entry)
            if (results.length >= limit) return results
        }
    }
    for (const entry of allEntries) {
        if (!entry.tag.toLowerCase().startsWith(q) && entry.tag.toLowerCase().includes(q)) {
            results.push(entry)
            if (results.length >= limit) return results
        }
    }
    return results
}
