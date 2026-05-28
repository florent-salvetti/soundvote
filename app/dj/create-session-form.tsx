'use client'

import { useState, useTransition } from 'react'
import { createSession } from '@/app/actions/session'

export default function CreateSessionForm({ libraryCount }: { libraryCount: number }) {
  const [useLibrary,  setUseLibrary]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [isPending,   startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createSession(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 flex flex-col gap-3">

      {/* Selector de source */}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-neon-green/20">
        {/* Checkbox visuel custom */}
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            useLibrary ? 'border-neon-green bg-neon-green' : 'border-gray-dim bg-transparent'
          }`}
          aria-hidden
        >
          {useLibrary && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="#0c0a14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <input
          type="checkbox"
          className="sr-only"
          checked={useLibrary}
          onChange={(e) => { setUseLibrary(e.target.checked); setError(null) }}
        />
        <div className="min-w-0 flex-1">
          <span className="font-sans text-sm text-cream">
            Utiliser mon repertoire Smule
          </span>
          {libraryCount > 0 && (
            <span className="ml-1.5 font-mono text-[10px] text-gray-dim">
              ({libraryCount} chansons)
            </span>
          )}
        </div>
      </label>

      {/* Valeur de source transmise a la Server Action */}
      <input type="hidden" name="source" value={useLibrary ? 'library' : 'itunes'} />

      {error && (
        <p className="rounded-xl border border-neon-magenta/20 bg-neon-magenta/10 px-4 py-3 font-sans text-sm text-neon-magenta">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-neon-green font-sans text-base font-semibold text-bg shadow-lg shadow-neon-green/20 transition-all hover:brightness-110 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-bg" />
            Creation...
          </>
        ) : (
          <>
            Nouvelle session
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>
    </form>
  )
}
