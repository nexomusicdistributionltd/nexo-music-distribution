alter table public.payouts
  add column if not exists payout_method_id uuid references public.payout_methods(id) on delete set null;
create index if not exists payouts_method_idx on public.payouts(payout_method_id);