'use client'

import { useState } from 'react'
import { computeWinner, type ResultRow } from '@/lib/round-results'

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

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
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-mid">
          Historique des manches ({rounds.length})
        </span>
        <svg
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
        <div className="max-h-[28rem] divide-y divide-border overflow-y-auto">
          {rounds.map((round) => {
            const { type, winners } = computeWinner(round.results)
            const total = round.results.reduce((sum, r) => sum + r.total, 0)

            return (
              <div key={round.id} className="px-5 py-4">
                <p className="mb-3 font-sans text-sm font-semibold text-cream">
                  {round.question}
                </p>

                <div className="mb-3 rounded-lg bg-surface-2 px-3 py-2.5">
                  {type === 'none' && (
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gray-dim">
                      Aucun vote.
                    </p>
                  )}
                  {type === 'single' && (
                    <p className="font-mono text-[10px] uppercase tracking-wider">
                      Gagnant{' '}
                      <span className="text-neon-green">{winners[0].label}</span>
                    </p>
                  )}
                  {type === 'tie' && (
                    <p className="font-mono text-[10px] uppercase tracking-wider">
                      Egalite{' '}
                      <span className="text-neon-magenta">
                        {winners.map((w) => w.label).join(' / ')}
                      </span>
                    </p>
                  )}
                </div>

                {round.results.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {round.results.map((r, idx) => {
                      const pct = total > 0 ? Math.round((r.total / total) * 100) : 0
                      const isWinner = type !== 'none' && winners.some((w) => w.option_id === r.option_id)
                      return (
                        <div key={r.option_id}>
                          <div className="mb-1 flex items-center gap-2.5">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[9px] font-bold ${
                              isWinner ? 'bg-neon-green text-bg' : 'bg-surface-2 text-gray-dim'
                            }`}>
                              {OPTION_LETTERS[idx] ?? idx + 1}
                            </span>
                            <div className="min-w-0 flex-1 flex items-baseline gap-2">
                              <span className={`font-sans text-xs font-semibold ${isWinner ? 'text-neon-green' : 'text-cream'}`}>
                                {r.label}
                              </span>
                              {r.artist && (
                                <span className="font-mono text-[9px] text-gray-dim">{r.artist}</span>
                              )}
                            </div>
                            <span className="shrink-0 font-mono text-[10px] tabular-nums text-gray-dim">
                              {r.total} ({pct}%)
                            </span>
                          </div>
                          <div className="ml-7 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                            <div
                              className={`bar-fill h-full rounded-full ${isWinner ? 'bg-neon-green/70' : 'bg-gray-dim/40'}`}
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
