create extension if not exists "uuid-ossp";

create type user_role as enum ('creator', 'eventee');
create type event_status as enum ('draft', 'published', 'cancelled');
create type ticket_status as enum ('pending', 'paid', 'cancelled');

create table eventful_users (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    password_hash text not null,
    name text not null,
    role user_role not null,
    created_at timestamptz default now()
);

create table events (
    id uuid primary key default uuid_generate_v4(),
    creator_id uuid not null references eventful_users(id) on delete cascade,
    title text not null,
    description text,
    location text,
    starts_at timestamptz not null,
    ends_at timestamptz,
    capacity int,
    ticket_price numeric(10, 2) not null default 0,
    status event_status not null default 'published',
    reminder_hours_before int,
    share_token text unique default encode(gen_random_bytes(8), 'hex'),
    created_at timestamptz default now()
);

create table tickets (
    id uuid primary key default uuid_generate_v4(),
    event_id uuid not null references events(id) on delete cascade,
    eventee_id uuid not null references eventful_users(id) on delete cascade,
    status ticket_status not null default 'pending',
    paystack_reference text,
    amount_paid numeric(10, 2),
    qr_code text,
    qr_scanned_at timestamptz,
    reminder_hours_before int,
    paid_at timestamptz,
    created_at timestamptz default now(),
    unique(event_id, eventee_id)
);

create table reminder_logs (
    id uuid primary key default uuid_generate_v4(),
    ticket_id uuid not null references tickets(id) on delete cascade,
    sent_at timestamptz default now()
);
