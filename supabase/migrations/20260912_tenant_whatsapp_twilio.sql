-- Twilio WhatsApp: keep a dedicated phone_number (synced with phone) and opt-in,
-- plus a private bucket so Twilio can fetch receipt PDFs via signed URLs.

alter table public.tenants
  add column if not exists phone_number text,
  add column if not exists whatsapp_opt_in boolean not null default false;

comment on column public.tenants.phone_number is
  'WhatsApp destination, kept in sync with tenants.phone.';

comment on column public.tenants.whatsapp_opt_in is
  'Whether the tenant has opted in to WhatsApp messages.';

update public.tenants
set phone_number = phone
where phone is not null
  and (phone_number is null or phone_number is distinct from phone);

update public.tenants
set whatsapp_opt_in = true
where coalesce(phone, '') <> '';

create or replace function public.sync_tenant_phone_number()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.phone_number is null then
      new.phone_number := new.phone;
    elsif new.phone is null then
      new.phone := new.phone_number;
    end if;
    return new;
  end if;

  if new.phone is distinct from old.phone then
    new.phone_number := new.phone;
  elsif new.phone_number is distinct from old.phone_number then
    new.phone := new.phone_number;
  end if;

  return new;
end;
$$;

drop trigger if exists tenants_sync_phone_number on public.tenants;
create trigger tenants_sync_phone_number
  before insert or update of phone, phone_number
  on public.tenants
  for each row
  execute procedure public.sync_tenant_phone_number();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-media',
  'whatsapp-media',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
