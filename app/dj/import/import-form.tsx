'use client'

import { useState, useTransition } from 'react'
import { importLibrary, type ImportResult } from '@/app/actions/library'

export default function ImportForm() {
  const [html, setHtml]       = useState('')
  const [result, setResult]   = useState<ImportResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!html.trim()) return
    setResult(null)
    startTransition(async () => {
      const res = await importLibrary(html)
      setResult(res)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      <div className="flex flex-col gap-2">
        <label
          htmlFor="html-input"
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim"
        >
          Code source de ta page Smule
        </label>
        <textarea
          id="html-input"
          value={html}
          onChange={(e) => { setHtml(e.target.value); setResult(null) }}
          disabled={isPending}
          placeholder={
            'Colle ici le code source de ta page profil Smule.\n\n' +
            'Comment faire :\n' +
            '1. Va sur ton profil Smule dans un navigateur\n' +
            '2. Appuie sur Ctrl+U (afficher le source)\n' +
            '3. Ctrl+A pour tout selectionner, Ctrl+C pour copier\n' +
            '4. Reviens ici et colle (Ctrl+V)'
          }
          rows={14}
          className="w-full resize-y rounded-xl border border-border bg-surface-2 px-4 py-3 font-mono text-xs text-cream placeholder-gray-dim outline-none transition-colors focus:border-neon-green/40 focus:ring-1 focus:ring-neon-green/15 disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || !html.trim()}
        className="flex h-14 items-center justify-center gap-2.5 rounded-xl bg-neon-green font-sans text-base font-semibold text-bg shadow-lg shadow-neon-green/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-bg" />
            Analyse en cours...
          </>
        ) : (
          <>
            Importer ma bibliotheque
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {result && (
        <div className={`rounded-xl border px-5 py-4 ${
          result.error
            ? 'border-neon-magenta/20 bg-neon-magenta/10'
            : 'border-neon-green/20 bg-neon-green/5'
        }`}>
          {result.error ? (
            <p className="font-sans text-sm text-neon-magenta">{result.error}</p>
          ) : (
            <>
              <p className="mb-2 font-mono text-[10px] tracking-[0.18em] uppercase text-neon-green">
                Import termine
              </p>
              <p className="font-sans text-sm text-cream">
                <span className="font-semibold text-neon-green">{result.imported}</span> chansons importees,{' '}
                <span className="font-semibold text-cream">{result.skipped_duplicates}</span> doublons ignores{' '}
                <span className="text-gray-dim">({result.total_parsed} analysees)</span>
              </p>
            </>
          )}
        </div>
      )}

    </form>
  )
}
