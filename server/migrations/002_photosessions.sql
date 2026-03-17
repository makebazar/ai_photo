-- Photosession domain: avatar, datasets, packs, promos, sessions, jobs.

create table if not exists avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  status text not null default 'none',
  astria_model_id text,
  last_trained_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avatars_status_chk check (status in ('none','training','ready','failed'))
);

create table if not exists datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  avatar_id uuid references avatars(id) on delete set null,
  status text not null default 'idle',
  uploaded_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint datasets_status_chk check (status in ('idle','uploading','ready'))
);

create table if not exists dataset_images (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  original_filename text,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists dataset_images_dataset_idx on dataset_images (dataset_id, created_at desc);

create table if not exists style_packs (
  id int primary key,
  slug text not null unique,
  title text not null,
  description text not null,
  status text not null default 'active',
  preview_urls jsonb not null default '[]'::jsonb,
  estimated_images int not null default 20,
  -- mapping hint to Astria pack object
  pack_object_id text,
  prompts_per_class int,
  costs_per_class jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint style_packs_status_chk check (status in ('active','hidden'))
);

create table if not exists promos (
  id text primary key,
  title text not null,
  caption text not null,
  kind text not null,
  status text not null default 'active',
  cover_url text,
  media_urls jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promos_kind_chk check (kind in ('text','photo','video')),
  constraint promos_status_chk check (status in ('active','hidden'))
);

create table if not exists photo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  mode text not null,
  pack_id int references style_packs(id) on delete set null,
  title text,
  prompt text,
  negative text,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_sessions_mode_chk check (mode in ('pack','custom')),
  constraint photo_sessions_status_chk check (status in ('queued','generating','done','failed','canceled'))
);

create index if not exists photo_sessions_user_created_idx on photo_sessions (user_id, created_at desc);

create table if not exists generated_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references photo_sessions(id) on delete cascade,
  url text not null,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists generated_photos_session_idx on generated_photos (session_id, created_at desc);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null default 'queued',
  progress int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  locked_at timestamptz,
  locked_by text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_kind_chk check (kind in ('avatar.train','session.generate')),
  constraint jobs_status_chk check (status in ('queued','running','done','failed'))
);

create index if not exists jobs_status_created_idx on jobs (status, created_at);

