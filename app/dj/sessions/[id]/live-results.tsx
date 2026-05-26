'use client'

import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

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
  const maxCount = total > 0 ? Math.max(...options.map((o) => counts[o.id] ?? 0)) : 0

  return (
    <div className="mt-6 flex flex-col gap-3">
      {options.map((o, idx) => {
        const count = counts[o.id] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const isLeader = total > 0 && count === maxCount && count > 0

        return (
          <div
            key={o.id}
            className={`rounded-xl border px-4 py-3 transition-colors ${
              isLeader ? 'border-neon-green/30 bg-neon-green/5' : 'border-border bg-surface'
            }`}
          >
            <div className="mb-2 flex items-center gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold ${
                isLeader ? 'bg-neon-green text-bg' : 'bg-surface-2 text-gray-mid'
              }`}>
                {OPTION_LETTERS[idx] ?? idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <span className={`font-sans text-sm font-semibold ${isLeader ? 'text-neon-green' : 'text-cream'}`}>
                  {o.label}
                </span>
                {o.artist && (
                  <span className="ml-2 font-mono text-[10px] text-gray-dim">{o.artist}</span>
                )}
              </div>
              <span className={`shrink-0 font-mono text-sm tabular-nums ${isLeader ? 'text-neon-green' : 'text-gray-mid'}`}>
                {count} <span className="text-[10px] text-gray-dim">({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`bar-fill h-full rounded-full ${isLeader ? 'bg-neon-green' : 'bg-gray-dim/50'}`}
                style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
              />
            </div>
          </div>
        )
      })}
      {total === 0 && (
        <p className="py-2 text-center font-mono text-[10px] tracking-widest uppercase text-gray-dim">
          En attente des premiers votes...
        </p>
      )}
    </div>
  )
}
