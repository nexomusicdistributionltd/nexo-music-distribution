alter table public.payout_requests
  add column if not exists payout_method_id uuid references public.payout_methods(id) on delete set null;
create index if not exists payout_requests_method_idx on public.payout_requests(payout_method_id);