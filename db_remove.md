Remove Auth, Database, and Backend
Context
The app has Google Sign-In auth and Cosmos DB persistence for saving/loading algorithm runs. The user has no plans for authenticated features, so we're stripping all of it out. Without auth/DB, the backend serves no purpose (its only remaining endpoint would be hardcoded presets), so we remove the entire backend and make this a frontend-only static app.

Plan
1. Move presets to frontend
Create frontend/src/data/presets.ts with the 4 preset configs currently hardcoded in backend/routes/runs.js (quick-demo, standard, high-mutation, small-population)
Export a Preset type and PRESETS array
2. Delete frontend files
frontend/src/hooks/use-auth.ts — Google Sign-In hook
frontend/src/hooks/use-api.ts — API/DB sync hook
frontend/src/api/client.ts — HTTP client + auth token
frontend/src/components/GoogleSignIn.tsx — sign-in UI
frontend/src/components/RunHistory.tsx — run history panel
3. Edit frontend/src/App.tsx
Remove imports: useAuth, useApi, GoogleSignIn, RunHistory
Remove: auth, apiHook, lastSyncedGenRef, activeRunIdRef
Remove: API run creation in handleStart, generation sync useEffect, handleLoadRun
Remove: error banner (apiHook.error)
Remove: <GoogleSignIn> from header, <RunHistory> ZoomablePanel
Import presets from data/presets.ts, pass directly to ConfigPanel
4. Edit frontend/src/components/ConfigPanel.tsx
Change Preset import from ../api/client to ../data/presets
5. Edit frontend/index.html
Remove <script src="https://accounts.google.com/gsi/client" ...>
6. Delete entire backend/ directory
No remaining purpose without auth/DB
7. Tofu infrastructure cleanup
Delete tofu/db.tf — Cosmos DB database + container
Delete tofu/backend.tf — Container App, DNS, certs, role assignments
Delete tofu/appconfig.tf — Cosmos DB endpoint config key
Delete tofu/keyvault.tf — Key Vault data source (only used for Google OAuth)
Edit tofu/outputs.tf — remove cosmos_db_, backend_api_url, container_app_, app_config_prefix outputs
Edit tofu/remote-state.tf:
Add default = "" to 5 now-unused variables (container_app_environment_id, cosmos_db_account_name, cosmos_db_account_id, azure_app_config_endpoint, azure_app_config_resource_id) — follows existing Auth0 pattern
Remove those 5 from the locals.infra block (only keep resource_group_name + dns_zone_name)
8. Update CLAUDE.md
Remove Cosmos DB, Auth, and backend API references
Verification
cd frontend && npm run build should succeed with no errors
cd tofu && tofu validate (if available) should pass
App should render and run the genetic algorithm without any sign-in UI or API calls
Stayed in plan mode
i think infra-bootstrap actually needs some kind of "backend" switch. i have two apps that are just frontend that have similar needs. they don't need the aca and db info assigned to them.
Task:Explore infra-bootstrap app module
IN
Read these files in d:\repos\infra-bootstrap and report their full contents:

1. `tofu/app/main.tf` — the app module that creates per-app resources
2. Any file that defines the `for_each` list of apps (might be in main.tf root or a locals block)
3. `tofu/main.tf` or wherever the app module is invoked
4. Any Spacelift configuration (`.spacelift/config.yml` or similar)
5. Any file that defines stack dependency outputs (what TF_VAR_infra_* variables get injected)

I need to understand:
- How apps are listed and configured (the for_each)
- How Spacelift stack dependencies inject variables into app stacks
- What the current app module creates per-app
- Whether there's already any per-app configuration/flags
Globpattern: "**/.spacelift/**"
Found 1 file
Read d:\repos\infra-bootstrap\tofu\variables.tf
Bash List all files in tofu directory
IN
ls -la "d:\repos\infra-bootstrap\tofu\" 2>&1

OUT
Exit code 2
/usr/bin/bash: eval: line 1: unexpected EOF while looking for matching `"'
Bash List all files in tofu directory
IN
ls -la d:/repos/infra-bootstrap/tofu/

OUT
total 67
drwxr-xr-x 1 upstairspc 197121    0 Mar  2 23:21 .
drwxr-xr-x 1 upstairspc 197121    0 Mar  5 07:58 ..
-rw-r--r-- 1 upstairspc 197121 5625 Mar  1 06:59 .terraform.lock.hcl
drwxr-xr-x 1 upstairspc 197121    0 Mar  2 10:19 app
-rw-r--r-- 1 upstairspc 197121 2027 Mar  1 18:38 auth.tf
-rw-r--r-- 1 upstairspc 197121 4486 Mar  1 16:39 dns.tf
-rw-r--r-- 1 upstairspc 197121  828 Mar  1 06:59 keyvault.tf
-rw-r--r-- 1 upstairspc 197121 6706 Mar  1 11:10 landing.tf
-rw-r--r-- 1 upstairspc 197121 6114 Mar  2 23:21 main.tf
-rw-r--r-- 1 upstairspc 197121 4522 Mar  1 18:38 oauth.tf
-rw-r--r-- 1 upstairspc 197121 4831 Mar  1 18:38 output.tf
drwxr-xr-x 1 upstairspc 197121    0 Mar  1 06:59 provider
-rw-r--r-- 1 upstairspc 197121  394 Mar  1 06:59 provider.tf
-rw-r--r-- 1 upstairspc 197121   40 Mar  1 06:59 README.md
-rw-r--r-- 1 upstairspc 197121  123 Mar  1 06:59 variables.tf
You've hit your limit · resets 5pm (America/Los_Angeles)

i just got more credit