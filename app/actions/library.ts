'use server'

import { load } from 'cheerio'
import type { AnyNode } from 'domhandler'
import { createClient } from '@/lib/supabase/server'

// Couvre les sequences ZWJ (❤️‍🔥), les emojis simples et les variation selectors orphelins.
// \p{Extended_Pictographic} supporte Node.js 18+ (requis par Next.js 16).
const EMOJI_RE =
  /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*|️|‍/gu

// Les phrases multi-mots passent en premier pour eviter les mots orphelins.
const NOISE_RE =
  /\b(?:acoustic\s+guitar|guitar\s+cover|piano\s+cover|acoustic\s+cover|short\s+cover|acoustic|cover|piano|guitar|by\s+steeven)\b/gi

function cleanTitle(raw: string): string {
  const s = raw
    .replace(EMOJI_RE, '')
    .replace(NOISE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*-+\s*|\s*-+\s*$/g, '')
    .trim()
  return s || raw.trim()
}

function isSmuleHandle(text: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(text) && (text.startsWith('_') || text.endsWith('_'))
}

function extractTitle($: ReturnType<typeof load>, anchorEl: AnyNode): string {
  let title = ''
  // Feuilles = elements sans enfant-element, iteres en ordre DOM.
  // On prend le premier qui n'est pas un handle Smule (ex: ___STEEVEN___).
  $(anchorEl).find('*').each((_, child) => {
    if (title) return false
    if ($(child).children().length > 0) return
    const text = $(child).text().trim()
    if (!text) return
    if (isSmuleHandle(text)) return
    title = text
  })
  return title
}

export type ImportResult = {
  imported: number
  skipped_duplicates: number
  total_parsed: number
  error?: string
}

export async function importLibrary(html: string): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { imported: 0, skipped_duplicates: 0, total_parsed: 0, error: 'Non authentifie' }
  }

  const $ = load(html)
  const seen = new Set<string>()
  const rows: {
    dj_id: string
    smule_url: string
    title_original: string
    title_clean: string
  }[] = []

  $('a[href*="/song/arr/"]').each((_, anchorEl) => {
    const $a = $(anchorEl)
    const href = $a.attr('href') ?? ''
    if (!href) return

    const smule_url = href.startsWith('http')
      ? href
      : `https://www.smule.com${href}`

    if (seen.has(smule_url)) return
    seen.add(smule_url)

    const title_original = extractTitle($, anchorEl)
    if (!title_original) return

    rows.push({
      dj_id: user.id,
      smule_url,
      title_original,
      title_clean: cleanTitle(title_original),
    })
  })

  const total_parsed = rows.length
  if (total_parsed === 0) {
    return { imported: 0, skipped_duplicates: 0, total_parsed: 0 }
  }

  let imported = 0
  let skipped_duplicates = 0
  const BATCH = 100

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('library_songs')
      .upsert(batch, { onConflict: 'dj_id,smule_url', ignoreDuplicates: true })
      .select('id')

    if (error) {
      return { imported, skipped_duplicates, total_parsed, error: error.message }
    }

    const done = data?.length ?? 0
    imported += done
    skipped_duplicates += batch.length - done
  }

  return { imported, skipped_duplicates, total_parsed }
}
