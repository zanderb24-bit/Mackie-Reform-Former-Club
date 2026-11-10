-- Mackie Player Hub. Run once in a fresh Supabase project as the database owner.
-- All access is denied until a profile is approved. Role never comes from signup metadata.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 100),
 role text not null default 'player' check(role in ('player','coach','administrator')),
 approved boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.teams (
 id uuid primary key default gen_random_uuid(),name text not null unique check(length(trim(name)) between 1 and 100),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.team_memberships (
 id uuid primary key default gen_random_uuid(),team_id uuid not null references public.teams on delete cascade,
 profile_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),unique(team_id,profile_id)
);
create index memberships_profile_idx on public.team_memberships(profile_id);
create table public.training_sessions (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 160),
 team_id uuid references public.teams on delete restrict,
 starts_at timestamptz not null,ends_at timestamptz not null,check(ends_at>starts_at and ends_at-starts_at<=interval '24 hours'),
 type text not null check(type in ('rugby','gym','meeting','match','recovery')),
 location text not null check(length(trim(location)) between 1 and 250),address text not null default '',
 coach_id uuid not null references public.profiles on delete restrict,
 description text not null default '',equipment text not null default '',
 attendance_enabled boolean not null default true,status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index sessions_starts_idx on public.training_sessions(starts_at);
create index sessions_team_idx on public.training_sessions(team_id);
create table public.training_attendance (
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.training_sessions on delete cascade,
 player_id uuid not null references public.profiles on delete cascade,
 status text not null check(status in ('attending','not_attending','unsure')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(session_id,player_id)
);
create index attendance_player_idx on public.training_attendance(player_id);
create table public.training_programmes (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 160),
 kind text not null check(kind in ('gym','field')),objective text not null check(length(trim(objective))>0),
 category text not null,difficulty text not null check(difficulty in ('All levels','Beginner','Intermediate','Advanced')),
 duration integer not null check(duration between 1 and 600),equipment text not null default '',
 instructions text not null default '',notes text not null default '',archived boolean not null default false,
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.training_drills (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 160),
 description text not null default '',duration integer not null check(duration between 1 and 180),
 sets_reps text not null default '',coaching_points text not null default '',equipment text not null default '',
 video_url text not null default '' check(video_url='' or video_url ~ '^https?://[^[:space:]]+$'),
 diagram_url text not null default '' check(diagram_url='' or diagram_url ~ '^https?://[^[:space:]]+$'),
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.programme_drills (
 id uuid primary key default gen_random_uuid(),programme_id uuid not null references public.training_programmes on delete cascade,
 drill_id uuid not null references public.training_drills on delete restrict,position integer not null check(position>=0),
 unique(programme_id,position),unique(programme_id,drill_id)
);
create index programme_drill_ref_idx on public.programme_drills(drill_id);
create table public.programme_assignments (
 id uuid primary key default gen_random_uuid(),programme_id uuid not null references public.training_programmes on delete restrict,
 team_id uuid references public.teams on delete restrict,player_id uuid references public.profiles on delete restrict,
 week_of date not null check(extract(isodow from week_of)=1),
 assigned_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default now(),check(num_nonnulls(team_id,player_id)=1)
);
create unique index assignments_team_unique on public.programme_assignments(programme_id,team_id,week_of) where team_id is not null;
create unique index assignments_player_unique on public.programme_assignments(programme_id,player_id,week_of) where player_id is not null;
create index assignments_player_idx on public.programme_assignments(player_id);
create index assignments_team_idx on public.programme_assignments(team_id);
create table public.gym_exercises (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 160),
 instructions text not null default '',video_url text not null default '' check(video_url='' or video_url ~ '^https?://[^[:space:]]+$'),
 created_by uuid not null references public.profiles on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.gym_programme_exercises (
 id uuid primary key default gen_random_uuid(),programme_id uuid not null references public.training_programmes on delete cascade,
 exercise_id uuid not null references public.gym_exercises on delete restrict,
 position integer not null check(position>=0),sets integer not null check(sets between 1 and 20),
 reps integer not null check(reps between 1 and 200),target text not null default '',
 rest_seconds integer not null check(rest_seconds between 0 and 1800),unique(programme_id,position)
);
create index gym_prescription_exercise_idx on public.gym_programme_exercises(exercise_id);
create table public.workout_logs (
 id uuid primary key default gen_random_uuid(),player_id uuid not null references public.profiles on delete cascade,
 programme_id uuid not null references public.training_programmes on delete restrict,
 assignment_id uuid not null references public.programme_assignments on delete restrict,
 performed_on date not null,notes text not null default '' check(length(notes)<=10000),completed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index workout_player_date_idx on public.workout_logs(player_id,performed_on desc);
create index workout_assignment_idx on public.workout_logs(assignment_id);
create index workout_programme_idx on public.workout_logs(programme_id);
create unique index workout_one_draft_idx on public.workout_logs(player_id,assignment_id) where completed_at is null;
create table public.workout_sets (
 id uuid primary key default gen_random_uuid(),workout_id uuid not null references public.workout_logs on delete cascade,
 exercise_id uuid not null references public.gym_exercises on delete restrict,
 set_number integer not null check(set_number between 1 and 20),
 weight_kg numeric(6,2) not null check(weight_kg between 0 and 600),reps integer not null check(reps between 1 and 200),
 created_at timestamptz not null default now(),unique(workout_id,exercise_id,set_number)
);
create index sets_exercise_idx on public.workout_sets(exercise_id);
create table public.bulletin_posts (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 160),
 message text not null check(length(trim(message)) between 1 and 10000),
 category text not null check(category in ('club_announcements','training_updates','matchday_information','social_events','equipment','general_discussion')),
 author_id uuid not null references public.profiles on delete restrict,
 pinned boolean not null default false,image_path text,
 external_url text not null default '' check(external_url='' or external_url ~ '^https?://[^[:space:]]+$'),
 expires_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index bulletin_recent_idx on public.bulletin_posts(pinned desc,created_at desc);
create index bulletin_author_idx on public.bulletin_posts(author_id);

-- Security-definer lookup helpers avoid recursive profile and assignment RLS.
create function public.member_role() returns text language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() and approved;
$$;
create function public.is_member() returns boolean language sql stable security definer set search_path=public as $$
 select public.member_role() is not null;
$$;
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.member_role() in ('coach','administrator'),false);
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.member_role()='administrator',false);
$$;
create function public.has_assignment(p_assignment uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_member() and exists(select 1 from public.programme_assignments a where a.id=p_assignment and
 (a.player_id=auth.uid() or exists(select 1 from public.team_memberships m where m.team_id=a.team_id and m.profile_id=auth.uid())));
$$;
create function public.can_programme(p_programme uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_staff() or (public.is_member() and exists(select 1 from public.programme_assignments a
 where a.programme_id=p_programme and public.has_assignment(a.id))) or
 (public.is_member() and exists(select 1 from public.workout_logs where programme_id=p_programme and player_id=auth.uid()));
$$;
create function public.owns_workout(p_workout uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_member() and exists(select 1 from public.workout_logs where id=p_workout and player_id=auth.uid());
$$;
create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$
 begin
 insert into public.profiles(id,display_name,role,approved) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'New member'),100),'player',false);
 return new;
 end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
create function public.touch_updated() returns trigger language plpgsql set search_path=public as $$
 begin new.updated_at=now(); return new; end;
$$;
create function public.protect_profile() returns trigger language plpgsql set search_path=public as $$
 begin
 if auth.uid() is not null then
  if not public.is_admin() then raise exception 'Only administrators can change profiles'; end if;
  if new.id<>old.id then raise exception 'Profile identity is immutable'; end if;
  if old.id=auth.uid() and (not new.approved or new.role<>'administrator') then raise exception 'Cannot remove your own administrator access'; end if;
 end if;
 return new;
 end;
$$;
create trigger profile_guard before update on public.profiles for each row execute function public.protect_profile();
create function public.guard_bulletin() returns trigger language plpgsql set search_path=public as $$
 begin
 if auth.uid() is null then return new; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.author_id<>old.author_id or new.created_at<>old.created_at) then raise exception 'Post ownership and creation date are immutable'; end if;
 if not public.is_admin() then
  if (tg_op='INSERT' and new.pinned) or (tg_op='UPDATE' and new.pinned<>old.pinned) then raise exception 'Only administrators can pin announcements'; end if;
  if tg_op='INSERT' or new.category is distinct from old.category then
   if not ((public.member_role()='player' and new.category='general_discussion') or
    (public.member_role()='coach' and new.category in ('training_updates','matchday_information','general_discussion'))) then raise exception 'Category is restricted'; end if;
  end if;
 end if;
 if new.image_path is not null and (tg_op='INSERT' or new.image_path is distinct from old.image_path) then
  if new.image_path not like auth.uid()::text||'/%' then raise exception 'Attach an image from your own upload folder'; end if;
 end if;
 return new;
 end;
$$;
create trigger bulletin_guard before insert or update on public.bulletin_posts for each row execute function public.guard_bulletin();
create function public.guard_workout() returns trigger language plpgsql set search_path=public as $$
 declare a public.programme_assignments;
 begin
 select * into a from public.programme_assignments where id=new.assignment_id;
 if a.id is null or a.programme_id<>new.programme_id then raise exception 'Programme does not match assignment'; end if;
 if new.performed_on<a.week_of or new.performed_on>a.week_of+6 or new.performed_on>(now() at time zone 'Europe/London')::date then raise exception 'Workout date must be within the assigned week and not in the future'; end if;
 if auth.uid() is not null then
  if new.player_id<>auth.uid() or not public.has_assignment(new.assignment_id) then raise exception 'Workout must belong to your assignment'; end if;
  if tg_op='UPDATE' and (new.player_id<>old.player_id or new.programme_id<>old.programme_id or new.assignment_id<>old.assignment_id or new.created_at<>old.created_at) then raise exception 'Workout ownership is immutable'; end if;
  if exists(select 1 from public.training_programmes where id=new.programme_id and archived) then raise exception 'Programme is archived'; end if;
 end if;
 if new.completed_at is not null then
  if tg_op='INSERT' or new.completed_at is distinct from old.completed_at then new.completed_at=now(); end if;
 end if;
 return new;
 end;
$$;
create trigger workout_guard before insert or update on public.workout_logs for each row execute function public.guard_workout();
create function public.guard_set() returns trigger language plpgsql set search_path=public as $$
 begin
 if tg_op='UPDATE' and (new.workout_id<>old.workout_id or new.exercise_id<>old.exercise_id or new.set_number<>old.set_number) then raise exception 'Set ownership is immutable'; end if;
 if not exists(select 1 from public.workout_logs l join public.gym_programme_exercises e on e.programme_id=l.programme_id
 where l.id=new.workout_id and e.exercise_id=new.exercise_id and new.set_number<=e.sets) then raise exception 'Set is not part of this workout prescription'; end if;
 return new;
 end;
$$;
create trigger set_guard before insert or update on public.workout_sets for each row execute function public.guard_set();
create function public.guard_attendance() returns trigger language plpgsql set search_path=public as $$
 begin
 if not exists(select 1 from public.training_sessions where id=new.session_id and attendance_enabled and status='scheduled') then raise exception 'Attendance is closed for this session'; end if;
 if tg_op='UPDATE' and (new.player_id<>old.player_id or new.session_id<>old.session_id) then raise exception 'Attendance ownership is immutable'; end if;
 return new;
 end;
$$;
create trigger attendance_guard before insert or update on public.training_attendance for each row execute function public.guard_attendance();

-- Preserve author identity and historical programme kind on staff edits.
create function public.guard_authorship() returns trigger language plpgsql set search_path=public as $$
 begin
 if new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'Record ownership and creation date are immutable'; end if;
 if tg_table_name='training_programmes' then
  if new.kind<>old.kind then raise exception 'Programme kind is immutable'; end if;
 end if;
 return new;
 end;
$$;
create trigger session_author_guard before update on public.training_sessions for each row execute function public.guard_authorship();
create trigger programme_author_guard before update on public.training_programmes for each row execute function public.guard_authorship();
create trigger drill_author_guard before update on public.training_drills for each row execute function public.guard_authorship();
create trigger exercise_author_guard before update on public.gym_exercises for each row execute function public.guard_authorship();
create function public.guard_session_coach() returns trigger language plpgsql security definer set search_path=public as $$
 begin
 if not exists(select 1 from public.profiles where id=new.coach_id and approved and role in ('coach','administrator')) then raise exception 'Choose an approved coach or administrator as organiser'; end if;
 return new;
 end;
$$;
create trigger session_coach_guard before insert or update on public.training_sessions for each row execute function public.guard_session_coach();

-- Every application table has explicit policies. Staff are club-wide senior coaches.
alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin() or (public.is_member() and approved));
create policy profile_admin_update on public.profiles for update to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.teams enable row level security;
create policy teams_read on public.teams for select to authenticated using(public.is_member());
create policy teams_admin on public.teams for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.team_memberships enable row level security;
create policy memberships_read on public.team_memberships for select to authenticated using(public.is_staff() or (public.is_member() and profile_id=auth.uid()));
create policy memberships_admin on public.team_memberships for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.training_sessions enable row level security;
create policy sessions_read on public.training_sessions for select to authenticated using(public.is_member());
create policy sessions_insert on public.training_sessions for insert to authenticated with check(public.is_staff() and created_by=auth.uid());
create policy sessions_update on public.training_sessions for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy sessions_delete on public.training_sessions for delete to authenticated using(public.is_admin());
alter table public.training_attendance enable row level security;
create policy attendance_read on public.training_attendance for select to authenticated using(public.is_staff() or (public.is_member() and player_id=auth.uid()));
create policy attendance_insert on public.training_attendance for insert to authenticated with check(public.is_member() and player_id=auth.uid());
create policy attendance_update on public.training_attendance for update to authenticated using(public.is_member() and player_id=auth.uid()) with check(public.is_member() and player_id=auth.uid());
create policy attendance_delete on public.training_attendance for delete to authenticated using(public.is_member() and player_id=auth.uid());
alter table public.training_programmes enable row level security;
create policy programmes_read on public.training_programmes for select to authenticated using(public.can_programme(id));
create policy programmes_insert on public.training_programmes for insert to authenticated with check(public.is_staff() and created_by=auth.uid());
create policy programmes_update on public.training_programmes for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy programmes_delete on public.training_programmes for delete to authenticated using(public.is_admin());
alter table public.training_drills enable row level security;
create policy drills_read on public.training_drills for select to authenticated using(public.is_member());
create policy drills_insert on public.training_drills for insert to authenticated with check(public.is_staff() and created_by=auth.uid());
create policy drills_update on public.training_drills for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy drills_delete on public.training_drills for delete to authenticated using(public.is_admin());
alter table public.programme_drills enable row level security;
create policy programme_drills_read on public.programme_drills for select to authenticated using(public.can_programme(programme_id));
create policy programme_drills_staff on public.programme_drills for all to authenticated using(public.is_staff()) with check(public.is_staff());
alter table public.programme_assignments enable row level security;
create policy assignments_read on public.programme_assignments for select to authenticated using(public.is_staff() or public.has_assignment(id));
create policy assignments_staff on public.programme_assignments for all to authenticated using(public.is_staff()) with check(public.is_staff() and assigned_by=auth.uid());
alter table public.gym_exercises enable row level security;
create policy exercises_read on public.gym_exercises for select to authenticated using(public.is_member());
create policy exercises_insert on public.gym_exercises for insert to authenticated with check(public.is_staff() and created_by=auth.uid());
create policy exercises_update on public.gym_exercises for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy exercises_delete on public.gym_exercises for delete to authenticated using(public.is_admin());
alter table public.gym_programme_exercises enable row level security;
create policy gym_items_read on public.gym_programme_exercises for select to authenticated using(public.can_programme(programme_id));
create policy gym_items_staff on public.gym_programme_exercises for all to authenticated using(public.is_staff()) with check(public.is_staff());
alter table public.workout_logs enable row level security;
create policy logs_read on public.workout_logs for select to authenticated using(public.is_staff() or (public.is_member() and player_id=auth.uid()));
create policy logs_insert on public.workout_logs for insert to authenticated with check(public.is_member() and player_id=auth.uid() and public.has_assignment(assignment_id));
create policy logs_update on public.workout_logs for update to authenticated using(public.is_member() and player_id=auth.uid()) with check(public.is_member() and player_id=auth.uid() and public.has_assignment(assignment_id));
create policy logs_delete on public.workout_logs for delete to authenticated using(public.is_member() and player_id=auth.uid());
alter table public.workout_sets enable row level security;
create policy sets_read on public.workout_sets for select to authenticated using(public.is_staff() or public.owns_workout(workout_id));
create policy sets_owner on public.workout_sets for all to authenticated using(public.owns_workout(workout_id)) with check(public.owns_workout(workout_id));
alter table public.bulletin_posts enable row level security;
create policy bulletin_read on public.bulletin_posts for select to authenticated using(public.is_member() and (expires_at is null or expires_at>now() or author_id=auth.uid() or public.is_admin()));
create policy bulletin_insert on public.bulletin_posts for insert to authenticated with check(public.is_member() and author_id=auth.uid());
create policy bulletin_update on public.bulletin_posts for update to authenticated using(public.is_member() and (author_id=auth.uid() or public.is_admin() or (public.member_role()='coach' and category in ('training_updates','matchday_information')))) with check(public.is_member() and (author_id=auth.uid() or public.is_admin() or (public.member_role()='coach' and category in ('training_updates','matchday_information'))));
create policy bulletin_delete on public.bulletin_posts for delete to authenticated using(public.is_member() and (author_id=auth.uid() or public.is_admin() or (public.member_role()='coach' and category in ('training_updates','matchday_information'))));

-- Atomic child replacement; all table RLS remains active (SECURITY INVOKER).
create function public.replace_programme_items(p_programme uuid,p_kind text,p_items jsonb) returns void language plpgsql security invoker set search_path=public as $$
 begin
 if not public.is_staff() then raise exception 'Coach permissions required'; end if;
 perform 1 from public.training_programmes where id=p_programme and kind=p_kind for update;
 if not found then raise exception 'Programme not found or type mismatch'; end if;
 if jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
 if p_kind='gym' then
  delete from public.gym_programme_exercises where programme_id=p_programme;
  insert into public.gym_programme_exercises(programme_id,exercise_id,position,sets,reps,target,rest_seconds)
   select p_programme,x.exercise_id,x.position,x.sets,x.reps,x.target,x.rest_seconds from jsonb_to_recordset(p_items) as x(exercise_id uuid,position int,sets int,reps int,target text,rest_seconds int);
 else
  delete from public.programme_drills where programme_id=p_programme;
  insert into public.programme_drills(programme_id,drill_id,position) select p_programme,x.drill_id,x.position from jsonb_to_recordset(p_items) as x(drill_id uuid,position int);
 end if;
 end;
$$;
-- Save programme metadata and prescriptions together, so a failed item rolls back everything.
create function public.save_programme(p_id uuid,p_programme jsonb,p_items jsonb) returns public.training_programmes language plpgsql security invoker set search_path=public as $$
 declare saved public.training_programmes;
 begin
 if not public.is_staff() then raise exception 'Coach permissions required'; end if;
 if p_id is null then
  insert into public.training_programmes(title,kind,objective,category,difficulty,duration,equipment,instructions,notes,created_by)
  values(p_programme->>'title',p_programme->>'kind',p_programme->>'objective',p_programme->>'category',p_programme->>'difficulty',
   (p_programme->>'duration')::int,coalesce(p_programme->>'equipment',''),coalesce(p_programme->>'instructions',''),coalesce(p_programme->>'notes',''),auth.uid()) returning * into saved;
 else
  update public.training_programmes set title=p_programme->>'title',objective=p_programme->>'objective',category=p_programme->>'category',
  difficulty=p_programme->>'difficulty',duration=(p_programme->>'duration')::int,equipment=coalesce(p_programme->>'equipment',''),
  instructions=coalesce(p_programme->>'instructions',''),notes=coalesce(p_programme->>'notes','')
  where id=p_id and kind=p_programme->>'kind' returning * into saved;
  if not found then raise exception 'Programme not found or type mismatch'; end if;
 end if;
 perform public.replace_programme_items(saved.id,saved.kind,p_items);
 return saved;
 end;
$$;
create function public.save_workout(p_log jsonb,p_sets jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
 declare saved uuid; finished timestamptz; kind text;
 begin
 if not public.is_member() then raise exception 'Approved membership required'; end if;
 if (p_log->>'player_id')::uuid<>auth.uid() then raise exception 'You can only save your own workouts'; end if;
 saved=coalesce((p_log->>'id')::uuid,gen_random_uuid());
 finished=(p_log->>'completed_at')::timestamptz;
 if p_log->>'id' is null then
  insert into public.workout_logs(id,player_id,programme_id,assignment_id,performed_on,notes)
   values(saved,auth.uid(),(p_log->>'programme_id')::uuid,(p_log->>'assignment_id')::uuid,(p_log->>'performed_on')::date,coalesce(p_log->>'notes',''));
 else
  update public.workout_logs set performed_on=(p_log->>'performed_on')::date,notes=coalesce(p_log->>'notes',''),completed_at=null where id=saved and player_id=auth.uid();
  if not found then raise exception 'Workout not found or not owned by you'; end if;
 end if;
 delete from public.workout_sets where workout_id=saved;
 insert into public.workout_sets(workout_id,exercise_id,set_number,weight_kg,reps)
  select saved,x.exercise_id,x.set_number,x.weight_kg,x.reps from jsonb_to_recordset(p_sets) as x(exercise_id uuid,set_number int,weight_kg numeric,reps int);
 select p.kind into kind from public.training_programmes p join public.workout_logs l on l.programme_id=p.id where l.id=saved;
 if finished is not null and kind='gym' and not exists(select 1 from public.workout_sets where workout_id=saved) then raise exception 'Record at least one set'; end if;
 if finished is not null then update public.workout_logs set completed_at=now() where id=saved; end if;
 return saved;
 end;
$$;

-- Prevent finalising empty gym workouts through direct REST writes as well as RPC.
create function public.check_workout_complete() returns trigger language plpgsql security definer set search_path=public as $$
 declare target uuid;
 begin
 if tg_table_name='workout_logs' then target=coalesce(new.id,old.id); else target=coalesce(new.workout_id,old.workout_id); end if;
 if exists(select 1 from public.workout_logs l join public.training_programmes p on p.id=l.programme_id
 where l.id=target and l.completed_at is not null and p.kind='gym' and not exists(select 1 from public.workout_sets s where s.workout_id=l.id)) then raise exception 'Completed gym workouts require a recorded set'; end if;
 return null;
 end;
$$;
create constraint trigger complete_log_check after insert or update on public.workout_logs deferrable initially deferred for each row execute function public.check_workout_complete();
create constraint trigger complete_set_check after delete or update on public.workout_sets deferrable initially deferred for each row execute function public.check_workout_complete();

do $$ declare t text; begin
 foreach t in array array['profiles','teams','training_sessions','training_attendance','training_programmes','training_drills','gym_exercises','workout_logs','bulletin_posts'] loop
 execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated()',t,t);
 end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','teams','team_memberships','training_sessions','training_attendance','training_programmes','training_drills','programme_drills','programme_assignments','gym_exercises','gym_programme_exercises','workout_logs','workout_sets','bulletin_posts'] loop
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
revoke all on function public.member_role(),public.is_member(),public.is_staff(),public.is_admin(),public.has_assignment(uuid),public.can_programme(uuid),public.owns_workout(uuid),public.new_profile(),public.touch_updated(),public.protect_profile(),public.guard_bulletin(),public.guard_workout(),public.guard_set(),public.guard_attendance(),public.replace_programme_items(uuid,text,jsonb),public.save_programme(uuid,jsonb,jsonb),public.save_workout(jsonb,jsonb),public.check_workout_complete(),public.guard_authorship(),public.guard_session_coach() from public,anon;
grant execute on function public.member_role(),public.is_member(),public.is_staff(),public.is_admin(),public.has_assignment(uuid),public.can_programme(uuid),public.owns_workout(uuid),public.replace_programme_items(uuid,text,jsonb),public.save_workout(jsonb,jsonb),public.save_programme(uuid,jsonb,jsonb) to authenticated;

-- Private image bucket. Storage service validates MIME type and 5 MB limit.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('bulletin-images','bulletin-images',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy bulletin_images_read on storage.objects for select to authenticated using(bucket_id='bulletin-images' and public.is_member());
create policy bulletin_images_insert on storage.objects for insert to authenticated with check(bucket_id='bulletin-images' and public.is_member() and (storage.foldername(name))[1]=auth.uid()::text and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy bulletin_images_delete on storage.objects for delete to authenticated using(bucket_id='bulletin-images' and public.is_member() and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
commit;
