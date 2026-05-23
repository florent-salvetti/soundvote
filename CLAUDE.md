# CLAUDE.md - SoundVote

Ce fichier cadre le projet. Lis-le en entier avant toute action. Lis aussi `cahier-des-charges.md`.

## Le produit en une phrase

Une appli web ou le DJ cree une session, partage un code court, et le public vote en direct depuis son navigateur sur la prochaine chanson. Le DJ voit les resultats en temps reel et garde le controle de la lecture.

Reference de mecanique : le party game "Use Your Words" (le public rejoint via une URL et un room code, le telephone devient une manette).

## Stack imposee (ne pas changer sans me demander)

- Next.js 16, App Router, TypeScript strict (proxy.ts remplace middleware.ts)
- Supabase : Postgres + Realtime + Auth (le DJ a un compte, le public non)
- Tailwind CSS
- Deploiement : Vercel
- Pas de Resend ni d'API Claude pour le MVP. Le sondage suffit.
- Spotify : plus tard, en option. On ne le code pas au depart.

## Regles de travail

- Avant toute grosse etape (scaffold, nouvelle table, nouvelle route), tu proposes un plan court et tu attends ma validation. Pas de gros chantier sans accord.
- Tu travailles par petits increments testables. Un increment = une chose qui marche.
- Les migrations Supabase passent par des fichiers SQL versionnes dans `supabase/migrations`, jamais en cliquant dans l'interface.
- Composants petits et lisibles. Server Components par defaut, Client Components seulement quand il faut de l'interactivite ou du Realtime.
- Aucun secret dans le repo. Tout en variables d'environnement. Tu fournis un `.env.example`.
- Quand tu doutes d'un choix structurant, tu me poses la question avant de coder, tu ne tranches pas seul.

## Conventions de code

- TypeScript strict, pas de `any` sauf cas justifie et commente.
- Nommage clair, en anglais dans le code.
- Commentaires utiles uniquement, en francais, pour expliquer le pourquoi pas le quoi.
- Gestion d'erreur systematique sur tous les appels reseau et Supabase.

## Regles editoriales pour tout texte affiche (UI, emails, copy)

- Interface en francais.
- Jamais de tiret cadratin (—). Tu utilises des points, des virgules ou tu reformules.
- Phrases courtes. Ton direct, humain, parle. Surtout pas de langage qui sent l'IA generee.
- Pas de blabla marketing inutile.

## Commandes utiles

- `npm run dev` : serveur de dev
- `npm run build` : build de prod
- `npx supabase db push` : pousse les migrations sur le projet cloud
- `npx supabase link --project-ref <ref>` : lie la CLI au projet Supabase cloud

## Etat d'avancement

Tiens cette section a jour a chaque session : ce qui est fait, ce qui reste, les decisions prises.

- [x] Projet scaffolde (Next.js 16, Tailwind, Supabase SSR, proxy auth, clients browser/server)
- [x] Schema Supabase et migrations (tables, RLS, vue vote_counts, fonction get_round_results, Realtime)
- [x] Auth DJ (login/signup, proxy protection /dj/*, redirect bidirectionnel)
- [x] Creation de session et code (alphabet non ambigu, retry sur 23505, lien partageable)
- [x] Ecran public (join par code, voter_anon_id localStorage, RLS anon teste)
- [x] Vote en temps reel : composition manche DJ + bascule Realtime ecran public (rounds uniquement)
- [x] Vote public avec feedback immediat + anti double-vote via localStorage (cle soundvote_vote_${roundId})
- [x] Console DJ avec resultats live (LiveResults : initialCounts serveur + re-fetch au montage + Realtime votes INSERT)
- [x] Cloture de manche : bouton DJ, bascule Realtime public vers resultats, bandeau gagnant/egalite/zero vote
- [ ] Deploiement Vercel

## Contraintes techniques a respecter

### Realtime
- Le public ne s'abonne JAMAIS a la table `votes` en Realtime. En mode public par defaut, Supabase Realtime ne filtre pas selon les RLS : un anon abonne a `votes` recevrait chaque insert en clair, ce qui casse toute la protection.
- Le public s'abonne uniquement a `rounds` (UPDATE, filtre session_id). Canal : `session-rounds-${sessionId}`.
- Seul le DJ (authenticated, client avec cookies) s'abonne aux inserts sur `votes`. Canal : `dj-votes-${roundId}`, filtre `round_id=eq.${roundId}`. Policy `dj_read_own_votes` assure que seuls ses propres votes lui sont relays.
- Anti double-vote public : localStorage cle `soundvote_vote_${roundId}` = optionId. Au chargement, si la cle existe, afficher l'etat vote sans resoumettre. Contrainte UNIQUE (round_id, voter_anon_id) en base = garde-fou final.
- LiveResults DJ : ordre strict au montage : 1) fetch vote_counts, 2) setCounts, 3) subscribe. Fenetre de course residuelle negligeable au niveau MVP.

## Decisions prises

- Next.js 16 installe (create-next-app@latest), migre de la stack initiale 15. middleware.ts devient proxy.ts, export middleware -> export proxy. Fonctionnalite identique.
- Supabase : cloud uniquement, pas de Docker local. Workflow : `supabase link` + `supabase db push`.
- QR code exclu du MVP. A ajouter apres deploiement.
- Pas de domaine custom pour le MVP. localhost en dev, URL Vercel en prod.
- Les policies RLS sont soumises a validation avant application.
- get_round_results est SECURITY DEFINER sans verif d'appartenance (choix MVP conscient : UUID non devinable).
