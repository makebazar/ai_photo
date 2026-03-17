-- Core schema for AI Photo backend (PostgreSQL)
-- Focus: MLM (2 levels), orders attribution, commissions, payouts.

create extension if not exists pgcrypto;

create table if not exists app_config (
  id int primary key default 1,
  config jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_config_singleton check (id = 1)
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint unique,
  username text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  public_id int generated always as identity unique,
  user_id uuid not null unique references users(id) on delete cascade,
  parent_partner_id uuid references partners(id) on delete set null,
  status text not null default 'active',
  client_code text not null unique,
  team_code text not null unique,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz,
  constraint partners_status_chk check (status in ('active','blocked'))
);

create table if not exists partner_balances (
  partner_id uuid primary key references partners(id) on delete cascade,
  available_rub int not null default 0,
  locked_rub int not null default 0,
  paid_out_rub int not null default 0,
  updated_at timestamptz not null default now(),
  constraint partner_balances_nonneg check (available_rub >= 0 and locked_rub >= 0 and paid_out_rub >= 0)
);

-- Optional attribution at signup (or first order)
create table if not exists client_attribution (
  user_id uuid primary key references users(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete restrict,
  code text,
  created_at timestamptz not null default now()
);

-- Click tracking for both client/team links (anti-fraud signals later)
create table if not exists referral_clicks (
  id bigserial primary key,
  kind text not null,
  code text not null,
  partner_id uuid references partners(id) on delete set null,
  clicked_at timestamptz not null default now(),
  ip inet,
  ua text,
  constraint referral_clicks_kind_chk check (kind in ('client','team'))
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plan_id text not null,
  amount_rub int not null,
  status text not null default 'unpaid',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  attribution_partner_id uuid references partners(id) on delete set null,
  attribution_kind text,
  constraint orders_plan_chk check (plan_id in ('standard','pro')),
  constraint orders_status_chk check (status in ('unpaid','paid','refunded','chargeback')),
  constraint orders_attr_kind_chk check (attribution_kind is null or attribution_kind in ('client'))
);

create table if not exists commissions (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  level smallint not null,
  percent numeric(5,2) not null,
  amount_rub int not null,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  constraint commissions_level_chk check (level in (0,1,2)),
  constraint commissions_status_chk check (status in ('available','locked','reversed')),
  constraint commissions_amount_chk check (amount_rub >= 0),
  constraint commissions_unique unique (order_id, partner_id, level)
);

create table if not exists partner_ledger (
  id bigserial primary key,
  partner_id uuid not null references partners(id) on delete cascade,
  entry_type text not null,
  amount_rub int not null,
  order_id uuid references orders(id) on delete set null,
  withdrawal_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists partner_ledger_partner_created_idx on partner_ledger (partner_id, created_at desc);
create index if not exists orders_user_created_idx on orders (user_id, created_at desc);
create index if not exists commissions_partner_created_idx on commissions (partner_id, created_at desc);

create table if not exists withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  amount_rub int not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  note text,
  signals jsonb not null default '[]'::jsonb,
  constraint withdrawals_status_chk check (status in ('pending','approved','rejected','paid')),
  constraint withdrawals_amount_chk check (amount_rub > 0)
);
