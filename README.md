# Mackie Rugby Player Hub

A responsive senior-team performance hub built with HTML, CSS and modular vanilla JavaScript. GitHub Pages hosts the files; Supabase provides email/password authentication, PostgreSQL, RLS and private image storage. There is no application backend or framework compilation step; GitHub Actions packages the static files for deployment.

## Run it

From the repository root:

```sh
python3 -m http.server 8000
```

Open `login.html` through the local static server. Choose **Explore the demo** to use the sample player experience before configuring Supabase. A static HTTP server is necessary for ES modules; opening HTML with `file://` is unsupported. Python is only a development file server, never a deployed backend.

Demo teams, coaches, sessions, times, locations and programmes are explicitly illustrative. They are **not official Mackie Rugby Club information**. Demo activity uses this tab's session storage and is not shared. No fake completion statistics are preloaded. `localStorage` holds only the theme preference; live club information always uses Supabase.

## Connect Supabase

1. Create a fresh Supabase project. In **SQL Editor**, execute [`supabase/migrations/001_player_hub.sql`](supabase/migrations/001_player_hub.sql) once, using the project owner connection. The migration creates all 14 application tables, constraints, indexes, signup/validation triggers, RLS, atomic save functions and the private `bulletin-images` bucket. It expects the standard Supabase `auth` and `storage` schemas. Do not apply it to an unrelated existing application database.
2. In **Authentication → Providers**, enable email/password and keep email confirmation enabled. Configure a production SMTP provider for club use; Supabase's default email sender is restricted and unsuitable for a full club rollout. Set an appropriate password policy and authentication rate limits in Supabase.
3. In **Authentication → URL Configuration**, set **Site URL** to your published `login.html` URL, for example `https://YOUR-ACCOUNT.github.io/Mackie-Reform-Former-Club/login.html`. Add that exact URL to the redirect allowlist. Add your local development `login.html` URL separately when testing. Password reset links return here. Keep production redirects specific.
4. Edit [`js/config.js`](js/config.js):

   ```js
   export const config = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR-PUBLIC-PUBLISHABLE-OR-LEGACY-ANON-KEY",
     timeZone: "Europe/London",
   };
   ```

   The project URL and **publishable/legacy anon key are public browser configuration**. Never use a `service_role`, secret key, database password or personal access token here. They bypass the access model and must never be committed or sent to the browser. Project settings → API Keys contains the public key. The client supports both current publishable keys and legacy JWT anon keys.

5. Configure the first administrator using the process below, then approve members and create your real teams. Once Supabase is configured, demo mode is unavailable on that copy of the site so sample storage cannot be confused with live data.

### Create the first administrator securely

1. Use **Request membership** in the application with the intended club administrator's email and name. Confirm the email using Supabase's message. The signup trigger always creates an **unapproved player**, regardless of any role or approval in submitted metadata.
2. As the trusted Supabase project owner, find this exact account in **Authentication → Users** and copy its UUID. Verify the account and email out of band. In SQL Editor run, substituting only the verified UUID:

   ```sql
   -- Run only as the trusted project owner in the Supabase SQL Editor.
   update public.profiles
   set role = 'administrator', approved = true
   where id = 'VERIFIED-AUTH-USER-UUID'::uuid
   returning id, display_name, role, approved;
   ```

3. Confirm **exactly one intended row** was returned. Sign in normally. Use **Administration** to approve other registrations, grant coach/administrator roles and maintain team memberships. Do not add a browser-side bootstrap flow or a public administrator signup code. An administrator cannot demote or unapprove themselves in the app, preventing accidental loss of the only administrator.
4. Administrators can revoke club access by clearing approval. RLS checks approval against the database on every data operation, including requests using an existing access token. To revoke authentication itself or delete an account, use the trusted Supabase Authentication dashboard. Keep this operator action separate from granting ordinary team access.

Registration with administrator approval is the supported membership gate. There is no public self-promotion or automatic approval. Pending users can read their own profile but cannot read club records or storage. The app intentionally does not provide an in-browser invitation-email service requiring privileged credentials.

### Optional demonstration seed

After an administrator has been created, run [`supabase/seed.sql`](supabase/seed.sql) as project owner. It is optional and idempotent: fixed sample IDs use `ON CONFLICT DO NOTHING`. It creates two Demo teams, current-week Tuesday/Thursday rugby, a Saturday match, a gym/recovery session, two strength programmes, a speed/agility programme, a reusable drill/exercise library and three announcements. Titles are prefixed `[DEMO]`; locations are examples.

Add a test player to **Senior XV · Demo** in Administration to expose the sample assigned programmes. No real member is automatically added to sample teams. Seed records use the existing approved coach/administrator as author, rather than manufacturing auth users. Rerunning preserves existing records and does not move old samples to a new week. Remove/archive demonstration content before real club use. Do not adopt example locations or schedules as official information.

## Using the hub

- **Overview:** next session, seven-day plan, three latest official posts, current-week programme assignments, completed gym count, upcoming activities and progress. Progress is completed assignments divided by the player's current-week assignments, using saved workout records. Each assignment represents one completion for its Monday–Sunday week. Team and individual assignments are separate activities; avoid assigning the same programme to a player twice through overlapping recipients unless intended.
- **Training Schedule:** month, week and weekly list; previous/next/today; team and activity filters; detailed session, map directions and equipment. Coaches can create/edit/reschedule/cancel; administrators can also permanently delete. Cancellations remain visible. Players save their own attending/not attending/unsure record; only staff see aggregate counts.
- **Training Programmes:** on-field and gym tabs. Coaches manage reusable drills and exercises, build programmes with prescriptions, duplicate, assign by team/player/week and archive/restore. Open the library on the relevant tab. Add library items first, then select them in a programme. Field diagrams and videos use validated external links. Archiving preserves history and prevents new workouts. Use Show archived to review older programmes and results; archived assignments are excluded from the active weekly plan.
- **Workout tracking:** open an assigned programme, start/resume a workout, enter actual kg/reps per completed set, save a draft or mark complete. Blank sets are not logged. Field activity uses a saved completion record. The workout date must fall inside the assigned week and cannot be in the future. Previous completed results appear beside current exercises. Workout history shows max load or total repetitions, session-to-session change, a chart and results table. Coaching staff can select a player in programme history; other players cannot read that history.
- **Club Bulletin Board:** category and keyword filters, pinned-first or newest sorting, post expiry, image attachments, external links and confirmed deletion. Players post in General Discussion and edit/delete their own posts. Coaches publish Training Updates, Matchday Information and General Discussion; they can moderate the first two categories. Administrators manage all six categories and can pin/unpin any post. Expired posts disappear from the active board; records remain retained in the database for operators.
- **Administration:** membership approval, roles, team creation/editing and team membership. Club-wide senior coaches are authorised to see all senior players' workout records and attendance. There is no per-team coaching-access subdivision in this version; grant coach roles accordingly.

Data mutations are saved immediately to Supabase, with errors surfaced before reporting success. Other devices see saved changes on navigation or reload. This version does not use live subscriptions, push notifications, offline writes or conflict-resolution syncing. When two staff edit the same record, the last saved edit wins.

## Security and data handling

- Every application table has RLS. Anonymous access has no table permissions. Authenticated routes additionally check approval for usability; the database enforces the actual boundary.
- Signup role metadata is ignored. Only approved administrators can update profiles and memberships. Direct API requests remain subject to RLS and validation triggers, regardless of hidden buttons.
- Players only mutate their own attendance, workouts and posts. Coaches cannot overwrite a player's workout records, although authorised coaches can read them. Staff manage the original programme; player logs never change its prescription.
- Programme metadata + exercise/drill changes and workout + set changes use atomic PostgreSQL functions with **security invoker** rights, preserving RLS. Definer functions are limited to guarded identity lookups, signup and completion validation, with fixed search paths.
- Times are stored as `timestamptz`, displayed in `Europe/London` and converted with daylight-saving awareness. Nonexistent spring times and ambiguous autumn times are rejected with guidance. Sessions are entered as same-day start/end times.
- Passwords go directly to Supabase Auth and are never stored by this app. Access/refresh tokens use tab-scoped session storage, with token refresh before expiry. Sign-out clears the session. Use a private, trusted device; normal browser XSS precautions remain relevant to any frontend token storage.
- Text is escaped before rendering. User links allow only HTTP(S), reject credential-bearing URLs, and open with `noopener noreferrer`. External media are links; drill diagrams are not uploaded to the bulletin bucket.
- Storage is **private**, with five-minute signed image URLs. The bucket permits JPEG, PNG and WebP only, maximum 5 MB; client validation matches the server settings. Users upload only inside their own UUID folder. Any approved member can read board images; only the uploader or an administrator can delete image objects. SVG/HTML uploads are excluded. The actual Supabase Storage service, rather than the PostgreSQL tests, enforces MIME/size metadata.
- Removing/replacing an attachment or deleting a post removes its board reference; uploaded files are retained in private Storage. Administrators must remove orphaned images in the Supabase Storage dashboard as part of retention housekeeping. An interrupted upload/save can also leave an orphan. Signed image URLs already issued can remain usable for up to five minutes after access revocation.
- Attendance and training data are personal information. Club operators should agree a retention policy, restrict staff roles, enable appropriate Supabase backups and review access before inviting members. Account deletion can be restricted by authored-record foreign keys; archive/anonymise or reassign authored club content with a trusted operator before deleting an author.

## Launch from the GitHub Actions tab

The repository includes **Test, build and launch Player Hub**, a manually runnable workflow in `.github/workflows/player-hub.yml`.

1. One time only: open GitHub **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. GitHub Pages must be available for the repository/account. If an environment approval is configured for `github-pages`, its reviewer must approve deployment.
2. Open **Actions → Test, build and launch Player Hub → Run workflow**.
3. Select **main**. Leave **Launch the tested site on GitHub Pages** checked, then select **Run workflow**. Uncheck it to test and build without deploying.
4. The workflow installs locked dependencies, runs PostgreSQL/RLS and utility tests, packages the static HTML in `_site`, and runs Chromium tests against that exact packaged site. Deployment starts only if these steps pass. A failed test stops deployment and leaves the existing website in place.
5. When **Launch on GitHub Pages** succeeds, open the **Player Hub is live** link in the job summary or the `github-pages` deployment URL. It will normally be `https://zanderb24-bit.github.io/Mackie-Reform-Former-Club/`. Use **Explore the demo** until you configure Supabase.

Pushes and pull requests targeting `main` also test and build automatically; they do not deploy. Manual deployments are restricted to `main`. Every successful build includes a downloadable **mackie-player-hub-site** artifact in the workflow run. Browser reports are retained for seven days, and site downloads for fourteen days. The artifact contains only HTML, CSS, browser JavaScript and assets; database migrations, tests and npm dependencies are excluded.

GitHub Actions uses its built-in `GITHUB_TOKEN` with scoped Pages/OIDC permissions. No personal access token or Supabase secret is needed for demo deployments. This does not create or migrate a Supabase project. If the workflow reports that Pages is missing or not enabled, check the one-time Pages setting above and the account's Pages availability.

### Connect the deployed site to club data

Configure the public settings in `js/config.js` using the Supabase instructions above, commit and push the change, then run the workflow again. Update Supabase's Site URL and redirect allowlist to the published `login.html` URL. Keep HTTPS enabled. Verify real email delivery, password recovery, approval, image uploads, cross-device changes and private workout history with separate accounts before club rollout.

### Local static package

```sh
npm run build
python3 -m http.server 8000 --directory _site
```

The packaging command copies the existing static files; there is no JavaScript transpilation or runtime backend. GitHub Pages serves HTML directly. All links remain relative to support the repository subpath. Fonts and Lucide icons are vendored under `assets`; the site makes no font/CDN requests. Replace the placeholder `assets/icons/crest.svg` when the official logo is supplied. Opening the app with `file://` is still unsupported because browser ES modules require HTTP(S).

## Development and validation

Node.js 24 and Python 3.12 were used here. npm packages are development/test dependencies only. Use the existing checkout in this isolated cloud workspace; no extra Git worktree is necessary.

```sh
npm ci --cache /tmp/mackie-npm-cache
npm test
npm run test:browser
```

`npm test` runs London/DST and unsafe-content tests plus the full migration in PGlite (real PostgreSQL compiled to WASM). The database suite simulates Supabase's `auth.uid()`, auth users, roles and storage metadata; it runs policy attacks as the `authenticated` database role, tests atomic rollback and reruns the seed. It does **not** simulate hosted email, Storage upload HTTP validation or a Supabase network outage.

`npm run test:browser` starts a local static server if needed and uses system Chromium by default (`/usr/bin/chromium`). Set `CHROMIUM_PATH` to a different installed Chromium path. The tests cover protected-route handling, calendar/attendance, drafts and workout history, actual dashboard progress, bulletin editing/deletion/safe rendering, staff management, mobile navigation and overflow, and theme switching. Staff UI tests substitute an administrator fixture only inside the test browser; there is no production demo role escalation control. Backend permissions are separately tested in PostgreSQL.

Live Supabase integration and GitHub Pages publication must be verified after project configuration. No remote project or deployment was supplied during initial implementation, so those checks cannot be claimed as completed. Full password reset/email confirmation, real object uploads and persistence across real devices require that final integration check.

### Structure

```text
index.html, login.html, dashboard.html, schedule.html,
programmes.html, bulletin.html, admin.html
css/                 Shared branding, components and responsive styles
js/config.js         Public Supabase project settings
js/supabase-client.js Authenticated HTTP client and database adapter
js/auth.js           Auth, session and membership checks
js/navigation.js     Shared accessible application shell
js/data.js           Supabase data operations and isolated demo adapter
js/demo.js           Explicitly illustrative demo records
js/dashboard.js      Saved-record overview and weekly calendar
js/schedule.js       Calendar, session management and attendance
js/programmes.js     Programmes, prescriptions, library and assignment
js/gym-tracker.js     Personal set logging, drafts and history charts
js/bulletin.js        Posts, moderation, search and image handling
js/admin.js           Approval, team membership and role management
js/utils.js           Safe rendering, dialogs and London-time utilities
assets/              Local fonts, Lucide icons and logo placeholder
supabase/migrations/ Schema, RLS, triggers, Storage and atomic RPCs
supabase/seed.sql    Optional labelled demonstration records
tests/               PostgreSQL security and Chromium workflow tests
```
