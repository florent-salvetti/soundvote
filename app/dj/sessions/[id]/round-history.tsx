'use client'

import { useState } from 'react'
import { computeWinner, type ResultRow } from '@/lib/round-results'

type ClosedRound = { id: string; question: string; results: ResultRow[] }

export default function RoundHistory({ rounds }: { rounds: ClosedRound[] }) {
  const [open, setOpen] = useState(false)

  if (rounds.length === 0) return null

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-2"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-mid">
          Historique des manches ({rounds.length})
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-gray-dim transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="max-h-[28rem] overflow-y-auto divide-y divide-border">
          {rounds.map((round) => {
            const { type, winners } = computeWinner(round.results)
            const total = round.results.reduce((sum, r) => sum + r.total, 0)

            return (
              <div key={round.id} className="px-5 py-4">
                <p className="mb-3 text-sm font-semibold text-gray-hi">{round.question}</p>

                <div className="mb-3 rounded-lg bg-surface-2 px-3 py-2">
                  {type === 'none' && (
                    <p className="text-xs text-gray-mid">Aucun vote.</p>
                  )}
                  {type === 'single' && (
                    <p className="text-xs font-semibold">
                      Gagnant{' '}
                      <span className="text-neon-green">{winners[0].label}</span>
                    </p>
                  )}
                  {type === 'tie' && (
                    <p className="text-xs font-semibold">
                      Egalite{' '}
                      <span className="text-neon-magenta">
                        {winners.map((w) => w.label).join(' / ')}
                      </span>
                    </p>
                  )}
                </div>

                {round.results.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {round.results.map((r) => {
                      const pct = total > 0 ? Math.round((r.total / total) * 100) : 0
                      const isWinner = type !== 'none' && winners.some((w) => w.option_id === r.option_id)
                      return (
                        <div key={r.option_id}>
                          <div className="mb-1 flex items-baseline justify-between gap-4">
                            <div className="min-w-0">
                              <span className={`text-xs font-semibold ${isWinner ? 'text-neon-green' : 'text-gray-hi'}`}>
                                {r.label}
                              </span>
                              {r.artist && (
                                <span className="ml-1.5 text-xs text-gray-mid">{r.artist}</span>
                              )}
                            </div>
                            <span className="shrink-0 text-xs tabular-nums text-gray-mid">
                              {r.total} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#222]">
                            <div
                              className={`bar-fill h-full rounded-full ${isWinner ? 'bg-neon-green/70' : 'bg-gray-dim'}`}
                              style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
