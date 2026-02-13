alter table if exists objects
  add column if not exists collection_status text default 'owned';

alter table if exists objects
  add column if not exists collection_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'objects_collection_status_check'
  ) then
    alter table objects
      add constraint objects_collection_status_check
      check (collection_status in ('owned', 'researching') or collection_status is null);
  end if;
end $$;
