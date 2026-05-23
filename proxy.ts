import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)

  const { pathname } = request.nextUrl

  // Lecture de la session sans rafraichir les cookies (updateSession l'a deja fait)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll() { /* gere par updateSession */ },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Racine : redirige selon l'etat de connexion
  if (pathname === '/') {
    return NextResponse.redirect(new URL(user ? '/dj' : '/login', request.url))
  }

  // Routes DJ : rediriger vers /login si non connecte
  if (pathname.startsWith('/dj') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Page login : rediriger vers /dj si deja connecte
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dj', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
