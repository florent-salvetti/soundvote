// iTunes Search API + Last.fm track.getsimilar — aucune auth requise

const LASTFM_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY!

export type MusicTrack = {
  id:       string
  name:     string
  artist:   string
  imageUrl: string
}

type ItunesResult = {
  trackId:       number
  trackName:     string
  artistName:    string
  artworkUrl100: string
}

export async function searchTracks(query: string): Promise<MusicTrack[]> {
  if (!query.trim()) return []
  const params = new URLSearchParams({
    term:   query,
    media:  'music',
    entity: 'song',
    limit:  '5',
  })
  try {
    const res = await fetch(`https://itunes.apple.com/search?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return ((data.results as ItunesResult[]) ?? []).map((item) => ({
      id:       String(item.trackId),
      name:     item.trackName,
      artist:   item.artistName,
      imageUrl: item.artworkUrl100?.replace('100x100', '300x300') ?? '',
    }))
  } catch {
    return []
  }
}

export async function getRecommendations(
  trackName: string,
  artistName: string,
): Promise<MusicTrack[]> {
  try {
    const params = new URLSearchParams({
      method:      'track.getsimilar',
      artist:      artistName,
      track:       trackName,
      api_key:     LASTFM_KEY,
      format:      'json',
      limit:       '15',
      autocorrect: '1',
    })
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    const similar: { name: string; artist: { name: string } }[] = data.similartracks?.track ?? []

    const results: MusicTrack[] = []
    // Seed artist exclu pour eviter de le retrouver dans les recos
    const usedArtists = new Set([artistName.toLowerCase()])

    for (const t of similar) {
      if (results.length >= 3) break
      if (usedArtists.has(t.artist.name.toLowerCase())) continue

      const tracks = await searchTracks(`${t.name} ${t.artist.name}`)
      const match =
        tracks.find((tr) => tr.name.toLowerCase() === t.name.toLowerCase()) ?? tracks[0]
      const track = match ?? { id: t.name, name: t.name, artist: t.artist.name, imageUrl: '' }
      results.push(track)
      usedArtists.add(t.artist.name.toLowerCase())
    }
    return results
  } catch {
    return []
  }
}
