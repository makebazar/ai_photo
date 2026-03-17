-- Payment events for idempotent webhooks (provider-agnostic)

create table if not exists payment_events (
  id bigserial primary key,
  provider text not null,
  external_event_id text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  constraint payment_events_uniq unique (provider, external_event_id)
);

create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null,
  external_payment_id text,
  status text not null default 'created',
  amount_rub int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_intents_status_chk check (status in ('created','pending','paid','failed','refunded'))
);

create index if not exists payment_intents_order_idx on payment_intents (order_id);

