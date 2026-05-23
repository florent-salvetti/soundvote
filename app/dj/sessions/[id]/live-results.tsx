'use client'

import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Option = { id: string; label: string; artist: string | null }

export default function LiveResults({
  roundId,
  options,
  initialCounts,
}: {
  roundId: string
  options: Option[]
  initialCounts: Record<string, number>
}) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let channel: RealtimeChannel | undefined

    async function init() {
      // 1. Re-fetch les comptages actuels pour couvrir les votes arrives entre le rendu
      //    serveur (initialCounts) et le montage du composant.
      const { data } = await supabase
        .from('vote_counts')
        .select('option_id, total')
        .eq('round_id', roundId)

      if (!active) return

      if (data) {
        const fresh: Record<string, number> = {}
        for (const row of data as { option_id: string; total: number }[]) {
          fresh[row.option_id] = row.total
        }
        setCounts(fresh)
      }

      // 2. Abonnement apres le fetch frais.
      // Petite fenetre de course entre la fin du fetch et subscribe() : negligeable au niveau MVP.
      channel = supabase
        .channel(`dj-votes-${roundId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'votes',
            filter: `round_id=eq.${roundId}`,
          },
          (payload) => {
            const optionId = (payload.new as { option_id: string }).option_id
            setCounts((prev) => ({
              ...prev,
              [optionId]: (prev[optionId] ?? 0) + 1,
            }))
          }
        )
        .subscribe()
    }

    init()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [roundId])

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

  return (
    <div className="mt-6 flex flex-col gap-4">
      {options.map((o) => {
        const count = counts[o.id] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0

        return (
          <div key={o.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <span className="font-sans text-sm font-semibold text-gray-hi">{o.label}</span>
                {o.artist && (
                  <span className="ml-2 text-xs text-gray-mid">{o.artist}</span>
                )}
              </div>
              <span className="shrink-0 font-display text-sm tabular-nums text-neon-green">
                {count} <span className="text-gray-dim text-xs">({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="bar-fill h-full rounded-full bg-neon-green"
                style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
              />
            </div>
          </div>
        )
      })}
      {total === 0 && (
        <p className="text-center text-xs text-gray-dim">En attente des premiers votes...</p>
      )}
    </div>
  )
}
