'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinPage() {
  const router = useRouter()
  const [chars, setChars] = useState(['', '', '', ''])
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  function handleChange(index: number, raw: string) {
    // Garde uniquement le dernier caractere alphanumerique saisi
    const char = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-1)
    const next = [...chars]
    next[index] = char
    setChars(next)

    if (char && index < 3) {
      refs[index + 1].current?.focus()
    }

    if (next.every((c) => c !== '')) {
      router.push(`/join/${next.join('')}`)
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !chars[index] && index > 0) {
      refs[index - 1].current?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4)
    if (pasted.length === 0) return

    const next = ['', '', '', '']
    for (let i = 0; i < pasted.length && i < 4; i++) {
      next[i] = pasted[i]
    }
    setChars(next)

    const focusIdx = Math.min(pasted.length, 3)
    refs[focusIdx].current?.focus()

    if (next.every((c) => c !== '')) {
      router.push(`/join/${next.join('')}`)
    }
  }

  return (
    <main className="page-bg flex min-h-screen flex-col items-center justify-center px-6">

      {/* Logo */}
      <div className="mb-14 flex items-center gap-2.5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#f3ecdc" />
          <circle cx="12" cy="12" r="3" fill="#0c0a14" />
          <path d="M21 5.5C18.3 3 15.3 1.5 12 1.5" stroke="#0c0a14" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="font-display text-lg font-medium italic tracking-tight text-cream">
          soundvote
        </span>
      </div>

      {/* Hero */}
      <div className="mb-10 text-center">
        <p className="mb-3 font-mono text-[10px] tracking-[0.2em] uppercase text-gray-mid">
          Rejoindre une session
        </p>
        <h1 className="font-display text-3xl font-normal leading-tight text-cream">
          Entre le code<br />
          <span className="italic text-neon-green">du DJ</span>
        </h1>
      </div>

      {/* Saisie 4 cases */}
      <div className="flex gap-3">
        {chars.map((char, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="text"
            value={char}
            maxLength={2}
            autoComplete="off"
            autoFocus={i === 0}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className="h-16 w-14 rounded-xl border border-border bg-surface-2 text-center font-display text-2xl font-normal uppercase text-cream caret-neon-green outline-none transition-colors focus:border-neon-green/60 focus:ring-1 focus:ring-neon-green/20"
          />
        ))}
      </div>

      <p className="mt-8 font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
        Le code est affiche sur l&apos;ecran du DJ
      </p>

    </main>
  )
}
