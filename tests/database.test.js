import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const id = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const uid = {
  admin: id(1),
  coach: id(2),
  player: id(3),
  other: id(4),
  pending: id(5),
};
let db;
async function as(who, sql) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${uid[who]}',false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role;");
  }
}
async function denied(who, sql) {
  await assert.rejects(() => as(who, sql));
}
const migration = await readFile(
  new URL("../supabase/migrations/001_player_hub.sql", import.meta.url),
  "utf8",
);
test("PostgreSQL migration, signup, real RLS and atomic workout security", async (t) => {
  db = new PGlite();
  await db.exec(`
 create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
 create function storage.extension(text) returns text language sql as $$select split_part($1,'.',-1)$$;
 grant select,insert,delete on storage.objects to authenticated;
 `);
  await db.exec(migration);
  await t.test("signup ignores malicious administrator metadata", async () => {
    for (const [name, u] of Object.entries(uid))
      await db.query(`insert into auth.users values($1,$2)`, [
        u,
        { display_name: name, role: "administrator", approved: true },
      ]);
    const { rows } = await db.query(
      `select role,approved from profiles where id='${uid.player}'`,
    );
    assert.deepEqual(rows[0], { role: "player", approved: false });
    await db.exec(
      `update profiles set role='administrator',approved=true where id='${uid.admin}';update profiles set role='coach',approved=true where id='${uid.coach}';update profiles set approved=true where id in ('${uid.player}','${uid.other}');`,
    );
  });
  await t.test(
    "pending accounts cannot read club data or promote themselves",
    async () => {
      await db.exec(
        `insert into teams(id,name) values('${id(10)}','Senior team');`,
      );
      assert.equal((await as("pending", "select * from teams")).rows.length, 0);
      assert.equal(
        (
          await as(
            "player",
            `update profiles set role='administrator' where id='${uid.player}' returning *`,
          )
        ).rows.length,
        0,
      );
      await denied(
        "player",
        `insert into profiles(id,display_name,role,approved) values('${id(99)}','Intruder','administrator',true)`,
      );
    },
  );
  await t.test(
    "admin approval works; administrators cannot remove their own access",
    async () => {
      assert.equal(
        (
          await as(
            "admin",
            `update profiles set approved=true where id='${uid.pending}' returning id`,
          )
        ).rows.length,
        1,
      );
      await denied(
        "admin",
        `update profiles set role='player' where id='${uid.admin}'`,
      );
      await as(
        "admin",
        `update profiles set approved=false where id='${uid.pending}'`,
      );
    },
  );
  await t.test(
    "staff create sessions; players only change their attendance",
    async () => {
      await as(
        "coach",
        `insert into training_sessions(id,title,starts_at,ends_at,type,location,coach_id,created_by) values('${id(20)}','Training',now()+interval '1 day',now()+interval '2 days'-interval '1 hour','rugby','Example','${uid.coach}','${uid.coach}')`,
      );
      await denied(
        "player",
        `insert into training_sessions(title,starts_at,ends_at,type,location,coach_id,created_by) values('Bad',now(),now()+interval '1 hour','rugby','Example','${uid.coach}','${uid.player}')`,
      );
      await as(
        "player",
        `insert into training_attendance(session_id,player_id,status) values('${id(20)}','${uid.player}','attending')`,
      );
      await denied(
        "other",
        `insert into training_attendance(session_id,player_id,status) values('${id(20)}','${uid.player}','unsure')`,
      );
      assert.equal(
        (await as("other", "select * from training_attendance")).rows.length,
        0,
      );
      assert.equal(
        (await as("coach", "select * from training_attendance")).rows.length,
        1,
      );
      await as(
        "coach",
        `update training_sessions set status='cancelled' where id='${id(20)}'`,
      );
      await denied(
        "player",
        `update training_attendance set status='unsure' where player_id='${uid.player}'`,
      );
    },
  );
  let logId;
  await t.test(
    "private assignments and workout records; set validation; atomic saves",
    async () => {
      await db.exec(
        `insert into training_programmes(id,title,kind,objective,category,difficulty,duration,created_by) values('${id(30)}','Strength','gym','Get stronger','Upper-body strength','Intermediate',45,'${uid.coach}');insert into gym_exercises(id,name,created_by) values('${id(31)}','Bench','${uid.coach}');insert into gym_programme_exercises(programme_id,exercise_id,position,sets,reps,rest_seconds) values('${id(30)}','${id(31)}',0,3,6,90);insert into programme_assignments(id,programme_id,player_id,week_of,assigned_by) values('${id(32)}','${id(30)}','${uid.player}',date_trunc('week',now() at time zone 'Europe/London')::date,'${uid.coach}');`,
      );
      assert.equal(
        (await as("other", "select * from training_programmes")).rows.length,
        0,
      );
      assert.equal(
        (await as("player", "select * from training_programmes")).rows.length,
        1,
      );
      const log = {
        player_id: uid.player,
        programme_id: id(30),
        assignment_id: id(32),
        performed_on: new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
        completed_at: new Date().toISOString(),
        notes: "Good",
      };
      const set = {
        exercise_id: id(31),
        set_number: 1,
        weight_kg: 60,
        reps: 6,
      };
      const sql = (l, s) =>
        `select save_workout('${JSON.stringify(l)}'::jsonb,'${JSON.stringify(s)}'::jsonb) as id`;
      logId = (await as("player", sql(log, [set]))).rows[0].id;
      assert.equal(
        (await as("other", "select * from workout_logs")).rows.length,
        0,
      );
      assert.equal(
        (await as("other", "select * from workout_sets")).rows.length,
        0,
      );
      assert.equal(
        (await as("coach", "select * from workout_sets")).rows.length,
        1,
      );
      await denied("other", sql({ ...log, id: logId }, [set]));
      await denied(
        "player",
        sql({ ...log, id: logId }, [{ ...set, weight_kg: -1 }]),
      );
      assert.equal(
        (await as("player", "select weight_kg from workout_sets")).rows[0]
          .weight_kg,
        "60.00",
      );
      await denied("player", sql({ ...log, id: logId }, []));
      await denied("player", "delete from workout_sets");
      assert.equal(
        (
          await as(
            "player",
            `update training_programmes set title='Tampered' returning *`,
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "programme metadata and prescriptions roll back together on invalid saves",
    async () => {
      const programme = {
        title: "Atomic programme",
        kind: "gym",
        objective: "Strength",
        category: "Upper-body strength",
        difficulty: "Intermediate",
        duration: 45,
        equipment: "Barbell",
        instructions: "Control",
        notes: "",
      };
      const items = [
        {
          exercise_id: id(31),
          position: 0,
          sets: 3,
          reps: 8,
          target: "RPE 7",
          rest_seconds: 90,
        },
      ];
      const sql = (pId, p, i) =>
        `select (save_programme(${pId ? "'" + pId + "'::uuid" : "null"},'${JSON.stringify(p)}'::jsonb,'${JSON.stringify(i)}'::jsonb)).id as id`;
      const pId = (await as("coach", sql(null, programme, items))).rows[0].id;
      await denied(
        "coach",
        sql(pId, { ...programme, title: "Should roll back" }, [
          { ...items[0], sets: -1 },
        ]),
      );
      assert.equal(
        (
          await as(
            "coach",
            `select title from training_programmes where id='${pId}'`,
          )
        ).rows[0].title,
        "Atomic programme",
      );
      assert.equal(
        (
          await as(
            "coach",
            `select sets from gym_programme_exercises where programme_id='${pId}'`,
          )
        ).rows[0].sets,
        3,
      );
      await denied("player", sql(null, programme, items));
    },
  );
  await t.test(
    "bulletin ownership, official categories, pinning and moderation are enforced",
    async () => {
      await as(
        "player",
        `insert into bulletin_posts(id,title,message,category,author_id) values('${id(40)}','Hello','Team message','general_discussion','${uid.player}')`,
      );
      await denied(
        "player",
        `insert into bulletin_posts(title,message,category,author_id) values('Fake official','Bad','club_announcements','${uid.player}')`,
      );
      await denied(
        "player",
        `update bulletin_posts set pinned=true where id='${id(40)}'`,
      );
      assert.equal(
        (
          await as(
            "other",
            `update bulletin_posts set message='Stolen' where id='${id(40)}' returning *`,
          )
        ).rows.length,
        0,
      );
      await as(
        "admin",
        `update bulletin_posts set pinned=true where id='${id(40)}'`,
      );
      await as(
        "coach",
        `insert into bulletin_posts(id,title,message,category,author_id) values('${id(41)}','Update','Training update','training_updates','${uid.coach}')`,
      );
      assert.equal(
        (
          await as(
            "coach",
            `delete from bulletin_posts where id='${id(40)}' returning *`,
          )
        ).rows.length,
        0,
      );
      await as("player", `delete from bulletin_posts where id='${id(40)}'`);
    },
  );
  await t.test(
    "private storage denies pending accounts and foreign folders",
    async () => {
      await as(
        "player",
        `insert into storage.objects(bucket_id,name) values('bulletin-images','${uid.player}/photo.webp')`,
      );
      await denied(
        "other",
        `insert into storage.objects(bucket_id,name) values('bulletin-images','${uid.player}/fake.png')`,
      );
      await denied(
        "player",
        `insert into storage.objects(bucket_id,name) values('bulletin-images','${uid.player}/file.svg')`,
      );
      assert.equal(
        (await as("pending", "select * from storage.objects")).rows.length,
        0,
      );
      assert.equal(
        (await as("other", `delete from storage.objects returning *`)).rows
          .length,
        0,
      );
    },
  );
  await t.test(
    "all 14 application tables have RLS; demonstration seed is repeatable",
    async () => {
      const { rows } = await db.query(
        `select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'`,
      );
      assert.equal(rows.length, 14);
      assert.ok(rows.every((r) => r.relrowsecurity));
      await db.exec(`select set_config('request.jwt.claim.sub','',false)`);
      const seed = await readFile(
        new URL("../supabase/seed.sql", import.meta.url),
        "utf8",
      );
      await db.exec(seed);
      const first = await db.query("select count(*) from training_sessions");
      await db.exec(seed);
      assert.deepEqual(
        (await db.query("select count(*) from training_sessions")).rows,
        first.rows,
      );
    },
  );
  await db.close();
});
