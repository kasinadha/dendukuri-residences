-- RLS for payment_accounts so admins can read/update Joint, Kasi, Kanthu, Pratyu.

alter table public.payment_accounts enable row level security;

drop policy if exists payment_accounts_admin_all on public.payment_accounts;
create policy payment_accounts_admin_all
  on public.payment_accounts
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and coalesce(p.is_active, true)
    )
  );

-- Ensure the four owner accounts exist (idempotent).
insert into public.payment_accounts (code, label, sort_order, notes, upi_qr_url)
values
  ('joint', 'Joint account', 1, 'Shared Canara / joint receiving account', '/upi/default-receive-qr.png'),
  ('kasi', 'Kasi', 2, 'Kasinadha account', null),
  ('kanthu', 'Kanthu', 3, 'Kanthu account', null),
  ('pratyu', 'Pratyu', 4, 'Pratyu account', null)
on conflict (code) do update
  set
    label = excluded.label,
    sort_order = excluded.sort_order,
    notes = coalesce(public.payment_accounts.notes, excluded.notes),
    upi_qr_url = coalesce(
      nullif(trim(public.payment_accounts.upi_qr_url), ''),
      excluded.upi_qr_url
    ),
    updated_at = now();
