'use client'

import { useState, useTransition } from 'react'
import type { DrawLibraryResult } from '@/app/actions/round'

type Props = {
  availableCount: number
  drawAction: () => Promise<DrawLibraryResult>
}

export default function LibraryRoundButton({ availableCount, drawAction }: Props) {
  const [isPending,      startTransition] = useTransition()
  const [error,          setError]        = useState<string | null>(null)
  const [localExhausted, setExhausted]    = useState(availableCount === 0)

  const count = localExhausted ? 0 : availableCount
  const isFinal = count > 0 && count < 4

  function handleDraw() {
    setError(null)
    startTransition(async () => {
      const result = await drawAction()
      if (result?.poolExhausted) setExhausted(true)
      else if (result?.error) setError(result.error)
      // succes → redirect gere par la Server Action
    })
  }

  return (
    <div className="flex flex-col gap-3">

      {error && (
        <p className="rounded-xl border border-neon-magenta/20 bg-neon-magenta/10 px-4 py-3 font-sans text-sm text-neon-magenta">
          {error}
        </p>
      )}

      {count === 0 ? (
        /* Pool epuise */
        <div className="rounded-xl border border-border bg-surface px-5 py-5 text-center">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-gray-dim">
            Repertoire epuise
          </p>
          <p className="mt-2 font-sans text-sm text-gray-mid">
            Tout ton repertoire est passe pour cette session.
          </p>
        </div>
      ) : (
        <button
          onClick={handleDraw}
          disabled={isPending}
          className="flex h-14 w-full flex-col items-center justify-center rounded-xl bg-neon-green font-sans font-semibold text-bg shadow-lg shadow-neon-green/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <span className="flex items-center gap-2 text-base">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-bg" />
              Tirage en cours...
            </span>
          ) : isFinal ? (
            <>
              <span className="text-base">Lancer la manche finale</span>
              <span className="text-[11px] font-normal opacity-70">
                {count} titre{count > 1 ? 's' : ''} restant{count > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-2.5 text-base">
              Tirer au sort
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </button>
      )}
    </div>
  )
}
