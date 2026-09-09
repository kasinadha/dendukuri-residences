-- Allow short videos on maintenance / cleanliness reports.
-- Idempotent. Run after 20260910 (safe to re-run).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-photos',
  'maintenance-photos',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/3gpp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'maintenance_requests'
      and column_name = 'photo_paths'
  ) then
    execute $c$
      comment on column public.maintenance_requests.photo_paths is
        'Storage object paths in bucket maintenance-photos (photos and short videos).'
    $c$;
  end if;
end $$;
