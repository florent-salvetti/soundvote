// Authentification Spotify via PKCE (pas de secret cote serveur)

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array.buffer)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
const SCOPES    = 'user-read-private'

const LS_ACCESS  = 'sv_sp_access'
const LS_REFRESH = 'sv_sp_refresh'
const LS_EXP     = 'sv_sp_exp'
const LS_VERIFIER = 'sv_sp_verifier'
const LS_RETURN   = 'sv_sp_return'

export async function startSpotifyAuth(returnTo: string): Promise<void> {
  const verifier   = await generateCodeVerifier()
  const challenge  = await generateCodeChallenge(verifier)
  const redirectUri = `${window.location.origin}/spotify/callback`

  localStorage.setItem(LS_VERIFIER, verifier)
  localStorage.setItem(LS_RETURN, returnTo)

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          redirectUri,
    scope:                 SCOPES,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function exchangeCode(code: string): Promise<string> {
  const verifier    = localStorage.getItem(LS_VERIFIER) ?? ''
  const redirectUri = `${window.location.origin}/spotify/callback`
  const returnTo    = localStorage.getItem(LS_RETURN) ?? '/dj'

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     CLIENT_ID,
      code_verifier: verifier,
    }),
  })

  if (res.ok) {
    const data = await res.json()
    localStorage.setItem(LS_ACCESS,  data.access_token)
    localStorage.setItem(LS_EXP,     String(Date.now() + data.expires_in * 1000))
    if (data.refresh_token) localStorage.setItem(LS_REFRESH, data.refresh_token)
    localStorage.removeItem(LS_VERIFIER)
  }

  return returnTo
}

export function isSpotifyConnected(): boolean {
  return !!localStorage.getItem(LS_ACCESS)
}

export function disconnectSpotify(): void {
  localStorage.removeItem(LS_ACCESS)
  localStorage.removeItem(LS_REFRESH)
  localStorage.removeItem(LS_EXP)
}

export async function getSpotifyToken(): Promise<string | null> {
  const token     = localStorage.getItem(LS_ACCESS)
  const expiresAt = Number(localStorage.getItem(LS_EXP) ?? 0)
  if (!token) return null
  // Renouvelle si expiration dans moins de 5 minutes
  if (Date.now() > expiresAt - 5 * 60 * 1000) return refreshToken()
  return token
}

async function refreshToken(): Promise<string | null> {
  const refresh = localStorage.getItem(LS_REFRESH)
  if (!refresh) { disconnectSpotify(); return null }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refresh,
      client_id:     CLIENT_ID,
    }),
  })

  if (!res.ok) { disconnectSpotify(); return null }

  const data = await res.json()
  localStorage.setItem(LS_ACCESS, data.access_token)
  localStorage.setItem(LS_EXP,    String(Date.now() + data.expires_in * 1000))
  if (data.refresh_token) localStorage.setItem(LS_REFRESH, data.refresh_token)
  return data.access_token
}

// ── Types et appels API ───────────────────────────────────────────────────────

export type SpotifyTrack = {
  id:      string
  name:    string
  artists: { name: string }[]
  album:   { images: { url: string; width: number; height: number }[] }
}

export async function searchTracks(query: string, token: string): Promise<SpotifyTrack[]> {
  if (!query.trim()) return []
  const params = new URLSearchParams({ q: query, type: 'track', limit: '5', market: 'FR' })
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.tracks?.items ?? []) as SpotifyTrack[]
}

export async function getRecommendations(seedTrackId: string, token: string): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ seed_tracks: seedTrackId, limit: '3', market: 'FR' })
  const res = await fetch(`https://api.spotify.com/v1/recommendations?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.tracks ?? []) as SpotifyTrack[]
}

export function getTrackImageUrl(track: SpotifyTrack): string {
  // Prend la plus petite image disponible (suffisant pour une vignette)
  const sorted = [...track.album.images].sort((a, b) => a.width - b.width)
  return sorted[0]?.url ?? ''
}
