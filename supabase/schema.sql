-- Queen of the Krown database. Run once in Supabase → SQL Editor.
-- Every table has row level security: clients see only their own bookings, only the owner sees business data.

-- Who the owner is. The first account to claim it becomes the owner; after that it's locked.
create table if not exists public.owners (user_id uuid primary key references auth.users on delete cascade);
alter table public.owners enable row level security;
create policy "owner sees self" on public.owners for select using (user_id = auth.uid());

create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from owners where user_id = auth.uid()) $$;

create or replace function public.owner_exists() returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from owners) $$;

create or replace function public.claim_owner() returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from owners) then return exists (select 1 from owners where user_id = auth.uid()); end if;
  insert into owners values (auth.uid());
  return true;
end $$;

-- The owner's whole business (same shape the app already uses), synced between her devices.
create table if not exists public.owner_data (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.owner_data enable row level security;
create policy "owner only" on public.owner_data for all using (is_owner()) with check (is_owner());

-- What clients may see to book: business name, hours, services, and busy times (no names).
create table if not exists public.public_info (
  id int primary key default 1 check (id = 1),
  info jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.public_info enable row level security;
create policy "anyone reads" on public.public_info for select using (true);
create policy "owner writes" on public.public_info for all using (is_owner()) with check (is_owner());

-- Basic info collected at sign-up.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "owner reads profiles" on public.profiles for select using (is_owner());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone');
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Booking requests from clients. The owner confirms or declines them.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_name text not null check (length(client_name) between 1 and 100),
  phone text check (length(phone) <= 30),
  service_id text,
  service_name text not null check (length(service_name) <= 100),
  price int check (price >= 0),
  duration int not null default 120 check (duration between 15 and 720),
  date date not null,
  time text not null check (time ~ '^\d{2}:\d{2}$'),
  notes text not null default '' check (length(notes) <= 500),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled')),
  appt_id text,
  created_at timestamptz not null default now()
);
alter table public.bookings enable row level security;
create policy "clients request" on public.bookings for insert with check (client_id = auth.uid() and status = 'requested' and appt_id is null);
create policy "see own or owner" on public.bookings for select using (client_id = auth.uid() or is_owner());
create policy "owner updates" on public.bookings for update using (is_owner()) with check (is_owner());

-- Clients can only cancel their own booking, nothing else.
create or replace function public.cancel_booking(b uuid) returns void language sql security definer set search_path = public
as $$ update bookings set status = 'cancelled' where id = b and client_id = auth.uid() and status in ('requested', 'confirmed') $$;

-- Times already asked for, so two clients don't request the same slot. Only times, never names.
create or replace function public.taken_slots() returns table (date date, "time" text, duration int) language sql stable security definer set search_path = public
as $$ select b.date, b.time, b.duration from bookings b where b.status in ('requested', 'confirmed') and b.date >= current_date $$;
