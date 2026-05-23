# Cahier des charges - SoundVote

## 1. Objectif

Permettre a un DJ d'animer une salle en faisant voter le public sur la prochaine chanson, en direct, sans installation cote public.

## 2. Roles

- **DJ** : possede un compte. Cree une session, compose des manches de vote, lance et cloture les votes, voit les resultats en direct. Garde le controle de la lecture musicale (il mixe a la main, l'appli ne fait que le sondage).
- **Votant** : aucun compte. Rejoint via une URL et un code a 4 lettres. Identifie par un id anonyme stocke cote navigateur. Vote une fois par manche.

## 3. Parcours

### DJ
1. Se connecte.
2. Cree une session, obtient un code court (ex : `ABCD`) et un lien partageable.
3. Compose une manche : une question plus 2 a 4 propositions (titre, artiste).
4. Lance le vote. Voit les barres de resultats monter en temps reel.
5. Cloture. Le gagnant ressort. Le DJ lance le titre dans son logiciel de mix.
6. Manche suivante, et ainsi de suite. Termine la session quand il veut.

### Votant
1. Ouvre le lien ou va sur la page join et entre le code.
2. Tombe sur un ecran d'attente tant qu'aucun vote n'est lance.
3. Quand le DJ lance, la question et les propositions apparaissent automatiquement.
4. Tape sur son choix. Confirmation immediate.
5. Voit le resultat a la cloture.

## 4. Perimetre MVP

Dans le MVP :
- Auth DJ, creation de session, code court, lien partageable, QR code optionnel.
- Composition de manche, lancement, vote, cloture, gagnant.
- Temps reel sur les votes et le changement d'etat de manche.
- Anti double vote.

Hors MVP (plus tard) :
- Integration Spotify (proposition et lecture des titres).
- Historique des sessions, stats.
- Personnalisation visuelle par DJ.
- Mode spectateur grand nombre.

## 5. Modele de donnees (Supabase / Postgres)

Tables principales :

- `sessions` : `id`, `code` (texte court unique), `dj_id` (ref auth.users), `status` (`open` / `closed`), `created_at`.
- `rounds` : `id`, `session_id` (ref sessions), `question`, `status` (`lobby` / `voting` / `closed`), `created_at`.
- `options` : `id`, `round_id` (ref rounds), `label` (titre), `artist`, `position`.
- `votes` : `id`, `round_id` (ref rounds), `option_id` (ref options), `voter_anon_id` (texte), `created_at`. Contrainte unique sur (`round_id`, `voter_anon_id`) pour bloquer le double vote.

## 6. Logique temps reel

- On active Supabase Realtime sur les tables `votes` et `rounds`.
- Cote public : la page s'abonne au canal de la session. Un changement de `rounds` (passage en `voting`, puis `closed`) bascule l'ecran tout seul. Pas de polling.
- Cote DJ : abonnement aux inserts sur `votes` du round actif. A chaque insert, on recompte l'agregat par option et on rafraichit les barres.
- Agregation : ne pas renvoyer chaque vote individuel au client pour le comptage final. Utiliser une vue ou une fonction Postgres qui compte par option. Realtime sert juste de signal "il faut recompter".

## 7. Anti triche

- Contrainte unique en base sur (`round_id`, `voter_anon_id`).
- Id anonyme genere et stocke cote navigateur.
- Rate limit cote Edge Function ou middleware sur l'endpoint de vote.
- On accepte qu'un public motive puisse contourner partiellement sans login. L'objectif est de rendre le bourrage penible, pas impossible.

## 8. SQL de depart (a adapter par Claude Code dans une migration)

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  dj_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  question text not null,
  status text not null default 'lobby',
  created_at timestamptz not null default now()
);

create table options (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  label text not null,
  artist text,
  position int not null default 0
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  option_id uuid not null references options(id) on delete cascade,
  voter_anon_id text not null,
  created_at timestamptz not null default now(),
  unique (round_id, voter_anon_id)
);

-- Comptage par option pour un round
create view vote_counts as
select option_id, round_id, count(*) as total
from votes
group by option_id, round_id;
```

A cadrer avec Claude Code ensuite : les policies RLS. Le DJ ne touche que ses propres sessions. Le public peut lire la session, les rounds et options actifs via le code, et inserer un vote, sans pouvoir lire les votes des autres ni modifier quoi que ce soit.

## 9. Premiere instruction a donner a Claude Code

"Lis CLAUDE.md et cahier-des-charges.md. Ne code rien encore. Propose-moi le plan de mise en place du MVP, etape par etape, puis attends ma validation avant de scaffolder."
