-- Billing entitlements (subscription gating)
-- Additive: does not modify existing tables or columns.

create table if not exists billing_entitlements (
  org_id uuid primary key references orgs(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  entitlement_status text not null default 'unknown' check (
    entitlement_status in ('active', 'trialing', 'inactive', 'past_due', 'canceled', 'unknown')
  ),
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table billing_entitlements enable row level security;

-- Allow org members to read their org entitlement.
create policy "billing_entitlements_select" on billing_entitlements
  for select
  using (org_id = get_user_org_id());

-- Keep updated_at fresh.
create trigger update_billing_entitlements_updated_at before update on billing_entitlements
for each row execute function update_updated_at();

