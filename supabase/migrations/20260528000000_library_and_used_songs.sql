-- =============================================================
-- Bibliotheque Smule du DJ + blacklist de titres par session
-- =============================================================

-- -------------------------
-- TABLE library_songs
-- -------------------------

create table library_songs (
  id               uuid        primary key default gen_random_uuid(),
  dj_id            uuid        not null references auth.users(id) on delete cascade,
  title_original   text        not null,
  title_clean      text,
  artist           text,
  smule_url        text        not null,
  image_url        text,
  created_at       timestamptz not null default now(),
  unique (dj_id, smule_url)
);

create index library_songs_dj_id_idx on library_songs (dj_id);

-- -------------------------
-- TABLE session_used_songs
-- -------------------------

create table session_used_songs (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references sessions(id) on delete cascade,
  song_key    text        not null,
  created_at  timestamptz not null default now(),
  unique (session_id, song_key)
);

create index session_used_songs_session_id_idx on session_used_songs (session_id);

-- -------------------------
-- RLS
-- -------------------------

alter table library_songs      enable row level security;
alter table session_used_songs enable row level security;

-- library_songs : le DJ gere sa propre bibliotheque
create policy "dj_manage_own_library" on library_songs
  for all
  to authenticated
  using     (dj_id = auth.uid())
  with check (dj_id = auth.uid());

-- session_used_songs : le DJ proprietaire de la session peut tout faire
create policy "dj_manage_own_used_songs" on session_used_songs
  for all
  to authenticated
  using (
    exists (
      select 1 from sessions
      where sessions.id    = session_used_songs.session_id
        and sessions.dj_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sessions
      where sessions.id    = session_used_songs.session_id
        and sessions.dj_id = auth.uid()
    )
  );
