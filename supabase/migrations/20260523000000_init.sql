-- =============================================================
-- SoundVote - schema initial
-- =============================================================

-- -------------------------
-- TABLES
-- -------------------------

create table sessions (
  id         uuid        primary key default gen_random_uuid(),
  code       text        not null unique check (code ~ '^[A-Z]{4}$'),
  dj_id      uuid        not null references auth.users(id) on delete cascade,
  status     text        not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table rounds (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references sessions(id) on delete cascade,
  question   text        not null,
  status     text        not null default 'lobby' check (status in ('lobby', 'voting', 'closed')),
  created_at timestamptz not null default now()
);

create table options (
  id       uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  label    text not null,
  artist   text,
  position int  not null default 0
);

create table votes (
  id            uuid        primary key default gen_random_uuid(),
  round_id      uuid        not null references rounds(id) on delete cascade,
  option_id     uuid        not null references options(id) on delete cascade,
  voter_anon_id text        not null,
  created_at    timestamptz not null default now(),
  unique (round_id, voter_anon_id)
);

-- -------------------------
-- INDEX
-- -------------------------

-- Lookup rapide par code court (parcours public)
create index sessions_code_idx on sessions (code);
-- Agregation et Realtime sur les votes
create index votes_round_id_idx  on votes (round_id);
create index votes_option_id_idx on votes (option_id);

-- -------------------------
-- VUE vote_counts (DJ uniquement)
-- -------------------------

-- security_invoker = true : la vue respecte les RLS de l'appelant.
-- Le DJ (authenticated) voit ses propres votes via dj_read_own_votes.
-- L'anon ne recoit rien : pas de policy SELECT sur votes pour ce role.
create view vote_counts with (security_invoker = true) as
  select
    option_id,
    round_id,
    count(*)::int as total
  from votes
  group by option_id, round_id;

-- Pas de GRANT a anon : le public ne doit pas voir les comptes pendant le vote.
grant select on vote_counts to authenticated;

-- -------------------------
-- FONCTION get_round_results (public, uniquement si round cloture)
-- -------------------------

-- SECURITY DEFINER : s'execute avec les droits du proprietaire de la fonction,
-- ce qui lui permet d'agregger les votes sans RLS.
-- La garde est explicite : si le round n'est pas 'closed', on ne renvoie rien.
-- search_path fixe pour eviter l'injection via schema.
-- Choix MVP : la fonction ne verifie pas que le round appartient a l'appelant.
-- Tout anon connaissant l'UUID d'un round clos obtient ses resultats.
-- Acceptable car un UUID v4 n'est pas devinable (122 bits d'entropie).
create or replace function get_round_results(p_round_id uuid)
returns table (
  option_id uuid,
  label     text,
  artist    text,
  total     int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.id          as option_id,
    o.label,
    o.artist,
    coalesce(count(v.id), 0)::int as total
  from options o
  left join votes v
    on v.option_id = o.id
   and v.round_id  = p_round_id
  where o.round_id = p_round_id
    and exists (
      select 1 from rounds r
      where r.id     = p_round_id
        and r.status = 'closed'
    )
  group by o.id, o.label, o.artist, o.position
  order by total desc, o.position asc;
$$;

grant execute on function get_round_results(uuid) to anon, authenticated;

-- -------------------------
-- REALTIME
-- -------------------------

-- rounds : le public s'abonne pour detecter les changements d'etat (lobby -> voting -> closed)
-- votes  : le DJ s'abonne pour recompter les votes en direct
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table votes;

-- -------------------------
-- RLS
-- -------------------------

alter table sessions enable row level security;
alter table rounds   enable row level security;
alter table options  enable row level security;
alter table votes    enable row level security;

-- sessions : le DJ gere ses propres sessions
create policy "dj_manage_own_sessions" on sessions
  for all
  to authenticated
  using     (dj_id = auth.uid())
  with check (dj_id = auth.uid());

-- sessions : le public peut lire toutes les sessions (pour rejoindre par code, et voir si une session est fermee)
create policy "anon_read_sessions" on sessions
  for select
  to anon
  using (true);

-- rounds : le DJ gere les rounds de ses sessions
create policy "dj_manage_own_rounds" on rounds
  for all
  to authenticated
  using (
    exists (
      select 1 from sessions
      where sessions.id = rounds.session_id
        and sessions.dj_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sessions
      where sessions.id = rounds.session_id
        and sessions.dj_id = auth.uid()
    )
  );

-- rounds : le public peut lire tous les rounds
create policy "anon_read_rounds" on rounds
  for select
  to anon
  using (true);

-- options : le DJ gere les options de ses rounds
create policy "dj_manage_own_options" on options
  for all
  to authenticated
  using (
    exists (
      select 1 from rounds r
      join sessions s on s.id = r.session_id
      where r.id = options.round_id
        and s.dj_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from rounds r
      join sessions s on s.id = r.session_id
      where r.id = options.round_id
        and s.dj_id = auth.uid()
    )
  );

-- options : le public peut lire toutes les options
create policy "anon_read_options" on options
  for select
  to anon
  using (true);

-- votes : le DJ peut lire les votes de ses propres sessions (pour les resultats)
create policy "dj_read_own_votes" on votes
  for select
  to authenticated
  using (
    exists (
      select 1 from rounds r
      join sessions s on s.id = r.session_id
      where r.id = votes.round_id
        and s.dj_id = auth.uid()
    )
  );

-- votes : le public peut inserer un vote uniquement si le round est en cours (status = 'voting')
-- et si l'option appartient bien au round cible (anti-triche croise)
create policy "anon_insert_vote" on votes
  for insert
  to anon
  with check (
    exists (
      select 1 from rounds
      where rounds.id = votes.round_id
        and rounds.status = 'voting'
    )
    and exists (
      select 1 from options
      where options.id = votes.option_id
        and options.round_id = votes.round_id
    )
  );
