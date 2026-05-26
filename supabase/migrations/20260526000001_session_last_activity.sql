-- Tracking d'inactivite DJ : fermeture automatique apres 30 min sans action.
-- "Action" = lancer ou clore un round. La colonne est mise a jour cote serveur
-- dans les Server Actions correspondantes.
alter table sessions
  add column last_activity_at timestamptz not null default now();

-- Les sessions existantes repartent avec 30 min de marge.
update sessions set last_activity_at = now();
