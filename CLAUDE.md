# CLAUDE.md - SoundVote

Ce fichier cadre le projet. Lis-le en entier avant toute action. Lis aussi `cahier-des-charges.md`.

## Le produit en une phrase

Une appli web ou le DJ cree une session, partage un code court, et le public vote en direct depuis son navigateur sur la prochaine chanson. Le DJ voit les resultats en temps reel et garde le controle de la lecture.

Reference de mecanique : le party game "Use Your Words" (le public rejoint via une URL et un room code, le telephone devient une manette).

## Stack imposee (ne pas changer sans me demander)

- Next.js 15, App Router, TypeScript strict
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
- [ ] Creation de session et code
- [ ] Ecran public (join par code)
- [ ] Vote en temps reel (Realtime)
- [ ] Console DJ avec resultats live
- [ ] Cloture de manche et gagnant
- [ ] Deploiement Vercel

## Contraintes techniques a respecter

### Realtime (a appliquer a l'etape 7)
- Le public ne s'abonne JAMAIS a la table `votes` en Realtime. En mode public par defaut, Supabase Realtime ne filtre pas selon les RLS : un anon abonne a `votes` recevrait chaque insert en clair, ce qui casse toute la protection.
- Le public s'abonne uniquement a `rounds` (pour detecter les transitions lobby -> voting -> closed). C'est sans risque : `rounds` est lisible par anon.
- Seul le DJ (authenticated) s'abonne aux inserts sur `votes` pour son live. S'assurer que le canal est configure en mode prive avec l'autorisation Realtime activee.
- A l'etape 7, avant de coder l'abonnement public, confirmer ce decoupage et verifier la config Realtime cote Supabase.

## Decisions prises

- Next.js 16 installe (create-next-app@latest), migre de la stack initiale 15. middleware.ts devient proxy.ts, export middleware -> export proxy. Fonctionnalite identique.
- Supabase : cloud uniquement, pas de Docker local. Workflow : `supabase link` + `supabase db push`.
- QR code exclu du MVP. A ajouter apres deploiement.
- Pas de domaine custom pour le MVP. localhost en dev, URL Vercel en prod.
- Les policies RLS sont soumises a validation avant application.
- get_round_results est SECURITY DEFINER sans verif d'appartenance (choix MVP conscient : UUID non devinable).
