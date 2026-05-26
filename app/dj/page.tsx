import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { createSession } from '@/app/actions/session'
import DeleteSessionButton from './delete-session-button'
import { redirect } from 'next/navigation'

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

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, code, status, created_at')
    .eq('dj_id', user.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  return (
    <main className="page-bg min-h-screen px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-md">

        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-neon-green">
              SoundVote
            </p>
            <h1 className="font-display text-2xl font-extrabold text-white">
              Tableau de bord DJ
            </h1>
          </div>
          <form>
            <button
              formAction={logout}
              className="text-xs text-gray-mid transition-colors hover:text-white"
            >
              Se deconnecter
            </button>
          </form>
        </div>

        {/* CTA */}
        <form>
          <button
            formAction={createSession}
            className="mb-10 w-full rounded-xl bg-neon-green py-4 font-display text-sm font-bold tracking-wide text-bg transition-all hover:brightness-110 hover:glow-green"
          >
            + Creer une session
          </button>
        </form>

        {/* Liste des sessions */}
        {sessions && sessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-mid">
              Sessions
            </p>
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 transition-colors hover:border-neon-green/20"
              >
                <a href={`/dj/sessions/${s.id}`} className="flex flex-1 items-center gap-4 min-w-0">
                  <span className="font-display text-xl font-extrabold tracking-widest text-white">
                    {s.code}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-neon-green">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
                    En cours
                  </span>
                </a>
                <DeleteSessionButton sessionId={s.id} />
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
