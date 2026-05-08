import type { SectionId } from '../data/sections'

const RESERVED_CHARS = /[()[\]:]/g
const ESCAPED_RESERVED_CHARS = /\\([()[\]:])/g

function stripNovelAIWrappers(raw: string): string {
    let tag = raw.trim()
    let changed = true

    while (changed && tag.length >= 2) {
        changed = false
        const first = tag[0]
        const last = tag[tag.length - 1]
        if ((first === '{' && last === '}') || (first === '[' && last === ']')) {
            tag = tag.slice(1, -1).trim()
            changed = true
        }
    }

    return tag
}

function collapseNovelAIRandomizer(raw: string): string {
    const trimmed = raw.trim()
    const match = trimmed.match(/^\|\|(.+)\|\|$/)
    if (!match) return trimmed

    const firstChoice = match[1]
        .split('|')
        .map((choice) => choice.trim())
        .find(Boolean)

    return firstChoice ?? ''
}

function normalizeScoreTag(raw: string): string | null {
    const match = raw.match(/^score[\s_]+([1-9])(?:[\s_]+up)?$/i)
    if (!match) return null
    const hasUp = /[\s_]up$/i.test(raw)
    return hasUp ? `score_${match[1]}_up` : `score_${match[1]}`
}

function normalizeYearTag(raw: string): string | null {
    const match = raw.match(/^year[\s_]+(2\d{3})$/i)
    return match ? `year ${match[1]}` : null
}

function normalizeAnimaTagToken(
    raw: string,
    sectionId: SectionId | undefined,
    mode: 'storage' | 'output',
): string {
    let tag = raw.replace(ESCAPED_RESERVED_CHARS, '$1').trim()
    tag = collapseNovelAIRandomizer(tag)
    tag = stripNovelAIWrappers(tag)
    if (!tag) return ''

    const hasArtistPrefix = /^@+/.test(tag)
    tag = tag.replace(/^@+/, '').trim()
    if (!tag) return ''

    tag = tag.replace(/\s+/g, ' ').toLowerCase()
    tag = normalizeScoreTag(tag) ?? normalizeYearTag(tag) ?? tag.replace(/_/g, ' ')
    tag = tag.replace(/\s+/g, ' ').trim()
    tag = tag.replace(RESERVED_CHARS, '\\$&')

    const shouldUseArtistPrefix = hasArtistPrefix || (mode === 'output' && sectionId === 'artist')
    return shouldUseArtistPrefix ? `@${tag}` : tag
}

function normalizeAnimaTagList(
    raw: string,
    sectionId: SectionId | undefined,
    mode: 'storage' | 'output',
): string {
    return raw
        .split(',')
        .map((part) => normalizeAnimaTagToken(part, sectionId, mode))
        .filter(Boolean)
        .join(', ')
}

export function normalizeAnimaTagForStorage(raw: string, sectionId?: SectionId): string {
    return normalizeAnimaTagList(raw, sectionId, 'storage')
}

export function normalizeAnimaTagForOutput(raw: string, sectionId?: SectionId): string {
    return normalizeAnimaTagList(raw, sectionId, 'output')
}

export function normalizeDatasetTag(raw: string): string {
    return raw.trim().toLowerCase()
}
