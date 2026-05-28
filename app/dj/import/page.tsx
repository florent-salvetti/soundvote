import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ImportForm from './import-form'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="page-bg min-h-screen px-5 py-10 text-cream">
      <div className="mx-auto w-full max-w-md">

        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/dj"
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim transition-colors hover:text-cream"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Tableau de bord
          </Link>
        </div>

        {/* Titre */}
        <div className="mb-8">
          <p className="mb-2 font-mono text-xs tracking-[0.2em] uppercase text-neon-green">
            Bibliotheque
          </p>
          <h1 className="font-display text-3xl font-normal leading-tight text-cream">
            Importer ma<br />
            <span className="italic text-neon-green">bibliotheque Smule</span>
          </h1>
          <p className="mt-3 font-sans text-sm text-gray-mid">
            Colle le code source de ton profil Smule. SoundVote extrait tous tes titres et les garde pour tes prochaines sessions.
          </p>
        </div>

        <ImportForm />

      </div>
    </main>
  )
}
