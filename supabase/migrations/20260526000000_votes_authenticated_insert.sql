-- Permet aux utilisateurs authentifies (ex: DJ testant la page publique)
-- d'inserer un vote avec les memes conditions que les anonymes.
-- Sans cette policy, un utilisateur connecte se voit refuse par RLS
-- meme si le round est en cours et l'option valide.
create policy "authenticated_insert_vote" on votes
  for insert
  to authenticated
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
