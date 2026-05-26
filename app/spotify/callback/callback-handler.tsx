'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { exchangeCode } from '@/lib/spotify'

export default function CallbackHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const code  = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      router.replace('/dj')
      return
    }

    exchangeCode(code).then((returnTo) => {
      router.replace(returnTo)
    })
  }, [searchParams, router])

  return (
    <div className="flex items-center gap-3">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
      <p className="font-mono text-xs tracking-[0.2em] uppercase text-gray-mid">
        Connexion Spotify...
      </p>
    </div>
  )
}
