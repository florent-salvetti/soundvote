-- Champs Spotify sur les options (nullable : compatibilite avec mode manuel)
alter table options
  add column spotify_track_id  text,
  add column spotify_image_url text;
