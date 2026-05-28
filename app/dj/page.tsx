import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import DeleteSessionButton from './delete-session-button'
import CreateSessionForm from './create-session-form'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DjPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Ferme les sessions sans activite depuis plus de 30 min
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  await supabase
    .from('sessions')
    .update({ status: 'closed' })
    .eq('dj_id', user.id)
    .eq('status', 'open')
    .lt('last_activity_at', cutoff)

  // Stats globales
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('dj_id', user.id)

  const sessionIds = allSessions?.map((s) => s.id) ?? []
  const sessionCount = sessionIds.length

  const { count: roundCount } = sessionIds.length > 0
    ? await supabase
        .from('rounds')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds)
    : { count: 0 }

  // Sessions actives uniquement
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, code, status, created_at')
    .eq('dj_id', user.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  // Sessions fermees (pour permettre la suppression)
  const { data: closedSessions } = await supabase
    .from('sessions')
    .select('id, code, created_at')
    .eq('dj_id', user.id)
    .eq('status', 'closed')
    .order('created_at', { ascending: false })

  // Nombre de chansons dans la bibliotheque du DJ (pour le selecteur de source)
  const { count: libraryCount } = await supabase
    .from('library_songs')
    .select('id', { count: 'exact', head: true })
    .eq('dj_id', user.id)

  return (
    <main className="page-bg min-h-screen px-5 py-10 text-cream">
      <div className="mx-auto w-full max-w-md">

        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="#f3ecdc" />
              <circle cx="12" cy="12" r="3" fill="#0c0a14" />
              <path d="M21 5.5C18.3 3 15.3 1.5 12 1.5" stroke="#0c0a14" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="font-display text-lg font-medium italic tracking-tight text-cream">
              soundvote
            </span>
          </div>
          <form>
            <button
              formAction={logout}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim transition-colors hover:text-cream"
            >
              Deconnexion
            </button>
          </form>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <p className="mb-3 font-mono text-xs tracking-[0.2em] uppercase text-neon-green">
            Console DJ
          </p>
          <h1 className="font-display text-4xl font-normal leading-[0.95] tracking-tight text-cream">
            Pret a lancer<br />
            <span className="italic text-neon-green">une session ?</span>
          </h1>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface px-5 py-4">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
              Sessions
            </p>
            <p className="mt-1 font-display text-3xl font-normal text-cream">
              {sessionCount}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface px-5 py-4">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
              Manches
            </p>
            <p className="mt-1 font-display text-3xl font-normal text-cream">
              {roundCount ?? 0}
            </p>
          </div>
        </div>

        {/* CTA + selecteur de source */}
        <CreateSessionForm libraryCount={libraryCount ?? 0} />

        <Link
          href="/dj/import"
          className="mb-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-sans text-sm text-gray-mid transition-colors hover:border-cream/20 hover:text-cream"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Importer ma bibliotheque
        </Link>

        {/* Liste des sessions actives */}
        {sessions && sessions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="mb-1 font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
              Sessions actives
            </p>
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4 transition-colors hover:border-neon-green/20"
              >
                <a
                  href={`/dj/sessions/${s.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <span className="font-display text-xl font-normal tracking-[.15em] text-cream">
                    {s.code}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase text-neon-green">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
                    En direct
                  </span>
                </a>
                <DeleteSessionButton sessionId={s.id} />
              </div>
            ))}
          </div>
        )}

        {(!sessions || sessions.length === 0) && (
          <p className="mt-4 text-center font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
            Aucune session active
          </p>
        )}

        {/* Sessions fermees */}
        {closedSessions && closedSessions.length > 0 && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="mb-1 font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
              Sessions terminees
            </p>
            {closedSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-4 opacity-50"
              >
                <span className="flex min-w-0 flex-1 font-display text-xl font-normal tracking-[.15em] text-cream">
                  {s.code}
                </span>
                <DeleteSessionButton sessionId={s.id} />
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
