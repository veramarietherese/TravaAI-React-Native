-- TRAVA Stellar patch: production realtime trip messaging.
-- Idempotent and scoped to authenticated trip members.

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid unique references public.trips(trip_id) on delete cascade,
  title text not null default 'Trip Chat',
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null default '',
  attachment_url text,
  created_at timestamptz not null default now(),
  constraint chat_message_has_content check (char_length(btrim(body)) > 0 or attachment_url is not null),
  constraint chat_message_body_length check (char_length(body) <= 4000)
);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages(room_id, created_at desc);
create index if not exists chat_room_members_user_idx
  on public.chat_room_members(user_id, room_id);
create index if not exists chat_rooms_trip_idx
  on public.chat_rooms(trip_id);

alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;

grant select on public.chat_rooms to authenticated;
grant select on public.chat_room_members to authenticated;
grant select, insert on public.chat_messages to authenticated;

create or replace function public.is_chat_room_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_chat_room_member(uuid, uuid) from public;
grant execute on function public.is_chat_room_member(uuid, uuid) to authenticated;

drop policy if exists "chat rooms visible to members" on public.chat_rooms;
create policy "chat rooms visible to members"
on public.chat_rooms for select
to authenticated
using (public.is_chat_room_member(id));

drop policy if exists "chat members visible to members" on public.chat_room_members;
create policy "chat members visible to members"
on public.chat_room_members for select
to authenticated
using (public.is_chat_room_member(room_id));

drop policy if exists "messages visible to room members" on public.chat_messages;
create policy "messages visible to room members"
on public.chat_messages for select
to authenticated
using (public.is_chat_room_member(room_id));

drop policy if exists "members can send messages" on public.chat_messages;
create policy "members can send messages"
on public.chat_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_chat_room_member(room_id)
);

create or replace function public.ensure_trip_chat_room(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_trip_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select t.trip_name into v_trip_name
  from public.trips t
  where t.trip_id = p_trip_id
    and (
      t.user_id = auth.uid()
      or exists (
        select 1
        from public.trip_members tm
        where tm.trip_id = t.trip_id
          and tm.user_id = auth.uid()
          and tm.status = 'accepted'
      )
    );

  if v_trip_name is null then
    raise exception 'Trip not found or access denied';
  end if;

  insert into public.chat_rooms (trip_id, title, created_by)
  values (p_trip_id, coalesce(v_trip_name, 'Trip') || ' · TRAVA', auth.uid())
  on conflict (trip_id) do update
    set title = excluded.title,
        updated_at = now()
  returning id into v_room_id;

  insert into public.chat_room_members (room_id, user_id)
  select v_room_id, t.user_id
  from public.trips t
  where t.trip_id = p_trip_id
  on conflict do nothing;

  insert into public.chat_room_members (room_id, user_id)
  select v_room_id, tm.user_id
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.user_id is not null
    and tm.status = 'accepted'
  on conflict do nothing;

  return v_room_id;
end;
$$;

revoke all on function public.ensure_trip_chat_room(uuid) from public;
grant execute on function public.ensure_trip_chat_room(uuid) to authenticated;

create or replace function public.list_my_chat_rooms()
returns table (
  id uuid,
  trip_id uuid,
  title text,
  updated_at timestamptz,
  last_message text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.trip_id,
    r.title,
    r.updated_at,
    (
      select m.body
      from public.chat_messages m
      where m.room_id = r.id
      order by m.created_at desc
      limit 1
    ) as last_message
  from public.chat_rooms r
  where public.is_chat_room_member(r.id, auth.uid())
  order by r.updated_at desc;
$$;

revoke all on function public.list_my_chat_rooms() from public;
grant execute on function public.list_my_chat_rooms() to authenticated;

create or replace function public.sync_trip_chat_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  select id into v_room_id from public.chat_rooms where trip_id = new.trip_id;
  if v_room_id is null or new.user_id is null then
    return new;
  end if;

  if new.status = 'accepted' then
    insert into public.chat_room_members(room_id, user_id)
    values (v_room_id, new.user_id)
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted' then
    delete from public.chat_room_members
    where room_id = v_room_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_trip_chat_member_after_change on public.trip_members;
create trigger sync_trip_chat_member_after_change
after insert or update of status, user_id on public.trip_members
for each row execute function public.sync_trip_chat_member();

create or replace function public.touch_chat_room_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_rooms set updated_at = new.created_at where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists touch_chat_room_after_message on public.chat_messages;
create trigger touch_chat_room_after_message
after insert on public.chat_messages
for each row execute function public.touch_chat_room_from_message();

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;
