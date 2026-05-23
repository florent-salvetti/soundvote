import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { createSession } from '@/app/actions/session'
import DeleteSessionButton from './delete-session-button'
import { redirect } from 'next/navigation'

export default async function DjPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, code, status, created_at')
    .eq('dj_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-md">

        <div className="mb-10 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tableau de bord DJ</h1>
          <form>
            <button
              formAction={logout}
              className="text-sm text-zinc-500 transition-colors hover:text-white"
            >
              Se deconnecter
            </button>
          </form>
        </div>

        <form>
          <button
            formAction={createSession}
            className="mb-10 w-full rounded-xl bg-white py-4 font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            Creer une session
          </button>
        </form>

        {sessions && sessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
              Sessions
            </h2>
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 px-5 py-4 transition-colors hover:border-zinc-600"
              >
                <a href={`/dj/sessions/${s.id}`} className="flex flex-1 items-center gap-4">
                  <span className="font-mono text-xl font-bold tracking-widest">{s.code}</span>
                  <span className={`text-sm ${s.status === 'open' ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    {s.status === 'open' ? 'En cours' : 'Terminee'}
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
