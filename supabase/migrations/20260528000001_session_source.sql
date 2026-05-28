-- Source de tirage pour une session :
-- 'itunes'  = recherche iTunes/Last.fm (comportement actuel)
-- 'library' = repertoire Smule du DJ
alter table sessions
  add column source text not null default 'itunes'
    check (source in ('itunes', 'library'));
