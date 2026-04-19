-- Profiles: one row per authenticated user. Holds data that can't live on
-- auth.users directly (which Supabase owns). Each user gets a short,
-- shareable referral_code at signup. `referred_by_user_id` records which
-- existing user attributed this signup (set once, at claim time).
--
-- The signup -> profile row link is wired via an auth.users trigger so the
-- app never has to remember to create the row; the first time the app
-- queries `profiles` for a given user, the row is already there.

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null unique,
  referred_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint profiles_no_self_ref check (referred_by_user_id is null or referred_by_user_id <> user_id)
);

create index if not exists idx_profiles_referred_by
  on profiles(referred_by_user_id)
  where referred_by_user_id is not null;

-- 8-character code from an unambiguous alphabet (no 0/O/1/I/L). Collisions
-- are handled by a unique-constraint retry loop in the insert trigger.
create or replace function gen_referral_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..8 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

-- Create a profile row whenever a new auth user appears. Retries on the
-- off chance the generated code collides. SECURITY DEFINER so it can
-- insert regardless of the caller's RLS context (the trigger runs as the
-- auth user during signup, which has no direct insert permission on
-- profiles under the RLS policy below).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  attempts int := 0;
begin
  loop
    new_code := gen_referral_code();
    begin
      insert into profiles (user_id, referral_code) values (new.id, new_code);
      return new;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: create profile rows for any existing users who signed up
-- before this migration.
insert into profiles (user_id, referral_code)
select u.id, gen_referral_code()
from auth.users u
where not exists (select 1 from profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;

-- Referrals ledger. One row per successful attribution. `status` leaves
-- room for future reward fulfillment (pending -> rewarded). `rewarded_at`
-- is the hook the bead calls out as non-goals for now.
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'void')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  constraint referrals_no_self check (referrer_id <> referee_id),
  -- A referee is attributed to at most one referrer.
  unique (referee_id)
);

create index if not exists idx_referrals_referrer
  on referrals(referrer_id, created_at desc);

-- RLS. Profiles: a user reads their own row. Update is restricted to
-- empty-attribution rows and only via the claim_referral RPC, so we do
-- NOT grant a direct update policy; the RPC is SECURITY DEFINER.
alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = user_id);

-- Referrals: a user sees rows where they are either the referrer or the
-- referee. Insert/update/delete go through the claim_referral RPC, so
-- no direct write policies.
alter table referrals enable row level security;

create policy "Users can read their referrals"
  on referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);

-- Claim a referral code for the calling user. Fails silently (returns
-- false) on any validation miss: unknown code, self-referral, or the
-- caller has already been attributed. Succeeds exactly once per user.
create or replace function claim_referral(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  referrer uuid;
  normalized_code text;
begin
  if caller_id is null then
    return false;
  end if;
  if p_code is null then
    return false;
  end if;
  normalized_code := upper(trim(p_code));
  if normalized_code = '' then
    return false;
  end if;

  select user_id into referrer from profiles where referral_code = normalized_code;
  if referrer is null then
    return false;
  end if;
  if referrer = caller_id then
    return false;
  end if;

  update profiles
    set referred_by_user_id = referrer
    where user_id = caller_id
      and referred_by_user_id is null;
  if not found then
    return false;
  end if;

  insert into referrals (referrer_id, referee_id)
    values (referrer, caller_id)
    on conflict (referee_id) do nothing;

  return true;
end;
$$;

grant execute on function claim_referral(text) to authenticated;
