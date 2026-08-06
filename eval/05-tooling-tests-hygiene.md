# Evaluation 05 — Tooling, Tests, CI & Repo Hygiene

Environment recorded: Go 1.26.5 (go.mod requires 1.25.0), Node v26.4.0, npm 11.17.0, Wails CLI v2.12.0, branch `master`, origin `https://github.com/SugeethJSA/whats4linux.git`.

## 1. README claims vs reality (README.md)

| Claim | Reality | Verdict |
|---|---|---|
| L56 "Full chat history sync (TODO)" | Feature is **implemented** (`api/api.go:1051` `processHistorySync`; frontend consumes `wa:history_progress` at App.tsx:164-176) | STALE — remove the TODO |
| L20 "No Electron, no Node.js, no Chromium" | No Node at runtime is true, but **building requires Node** (wails.json `frontend:install: npm install`); on Windows the runtime is WebView2 (Chromium engine) | Misleading |
| L116-122 "`wails build` produces a binary" | True but incomplete: the **systray binary is required at runtime** (`api/api.go:500` → `StartSystray`), yet `wails build` alone doesn't build it (only `scripts/build` and release workflows do) | Incomplete docs |
| Badges/clone URLs `lugvitc/whats4linux` (L3, L117, L138, L161-163); go.mod:1; wails.json:11 author "celestix" | Origin is `SugeethJSA/whats4linux` | **Fork drift** — MED |
| L61 "SQLite-backed", L128 "WAL mode" | Confirmed (api/message.go:349) | TRUE |
| L86 "Respects XDG" | Confirmed (`os.UserConfigDir`, `os.UserCacheDir`) | TRUE |
| "No telemetry" | No telemetry call-sites | TRUE |
| Custom JS/CSS, Bezier editor, color editor | `Get/SetCustomJS/CSS`, EaseEditor, ComponentColorSelector all exist | TRUE |
| Not-a-wrapper / direct whatsmeow multi-device | Confirmed (api/client.go) | TRUE |

## 2. Frontend package.json

- **`"build": "tsc && vite build"` is a silent no-op for type-checking** (see §3) — **HIGH**.
- `@vitejs/plugin-react` is declared but **never wired** — `vite.config.ts:11` registers only `tailwindcss()`. No React Fast Refresh/HMR in dev.
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` — **no `eslint.config.*` file exists anywhere** → ESLint cannot run; 7 dead devDeps. No `lint` or `typecheck` npm scripts.
- `depcheck`: only false positive is `tailwindcss` (used via `@import "tailwindcss"` in style.css:1).
- **Dual lockfiles**: both `package-lock.json` (npm, fresh 2026-07-17) and `pnpm-lock.yaml` (v9, last touched 2026-01-10) are committed. `wails.json` and CI use npm; pnpm lock is inert — remove.
- `frontend/package.json.md5` — **not stale**: Wails v2.12 uses it to skip `npm install` when the hash matches. Keep.
- `tailwindcss`/`@tailwindcss/vite` are in `dependencies` (should be devDeps) — LOW.

## 3. tsconfig project-references trap

- `frontend/tsconfig.json` = `"files": []` + references to `tsconfig.app.json`/`tsconfig.node.json` (standard Vite scaffold).
- Plain `tsc` with `"files": []` resolves **zero input files** and exits 0 — verified locally. So `npm run build` and `wails build` never type-check.
- Fix: `"build": "tsc -b && vite build"` (or point at `tsconfig.app.json` explicitly). `tsc -b` currently passes — the code is healthy; the *pipeline* is the risk — **HIGH**.

## 4. Vite / Tailwind / prettier / qodana / wails.json / go.mod / Nix

- `vite.config.ts` — missing React plugin (§2); manualChunks otherwise fine.
- `tailwind.config.js` — **dead with Tailwind v4** (CSS-first config; v4 plugin ignores this file unless `@config` used). Stale v3 artifact.
- `.prettierrc` at repo root; CI `format.yaml` uses `creyD/prettier_action` over `frontend/src/**.tsx` — root `.prettierrc` is found; OK.
- `qodana.yaml` — pinned `jetbrains/qodana-go:2026.2`, but **no Qodana workflow exists** — orphaned config.
- `wails.json`: `"build:tags": "webkit2_41"` is what breaks build.yaml (see §5). `productVersion 1.0.0` vs `main.go:17-20` `version="0.0.0"` vs `package.nix:3` `0.0.1` — three divergent versions. Author `celestix` (fork drift).
- `go.mod` — module `github.com/lugvitc/whats4linux` (fork drift), `go 1.25.0`, trailing commented `replace` line (dead comment), `purpshell/meowcaller` used for calls (verified compiling).
- Nix: `flake.lock` pinned ~2026-01-11; `package.nix` hardcodes `npmDepsHash` + `vendorHash` — **breaks on any dependency bump**, no CI validates it; `default.nix` uses channel `<nixpkgs>` (non-reproducible) while the flake is reproducible — inconsistent; `doBuild=false` + `cp -r ${frontend}/dist frontend/` pollutes the workspace — MED.

## 5. GitHub workflows — would they pass today?

| Workflow | Verdict |
|---|---|
| `build.yaml` | **BROKEN today (HIGH):** ubuntu-22.04 + `libwebkit2gtk-4.0-dev` only, but wails.json forces the `webkit2_41` tag → needs `webkit2gtk-4.1.pc` (ships on 24.04) → link fails. `go install wails@latest` unpinned. Also does **not** run on `push`, only PR + dispatch |
| `release.yaml` | webkit 4.1 correct + `-tags webkit2_41`; but `wails@latest` unpinned; **nightly `if:` is commented out (L114)** → pre-release published on every run + force-pushed `nightly` tag; `fail-fast:true` aborts other OSes; hardcoded `-ldflags -X main.version=v1.0.0`; darwin/amd64 only, zip path assumption |
| `rolling-release.yaml` | **Best-corrected:** pins `wails@v2.12.0`, correct webkit 4.1 + pkg-config, builds systray first, injects version/commit/date ldflags — correct & current |
| `format.yaml` | prettier auto-commit + `gofmt -w .` from root (walks everything incl. systray). Not a test gate |
| **All four** | **No job runs `go test`, `vitest`, or `tsc -b`** — the project's 88 tests never execute in CI — **HIGH** |

## 6. Test inventory & coverage gaps

- **Go: 7 files / 19 tests — all pass** (`go test ./...`, ~6.3s): api/community_test.go, api/media_test.go, internal/cache, internal/markdown, internal/store (2 files), shared/socket.
- **Frontend: 6 files / 69 tests — all pass** (vitest 4.1.10).
- **Gaps (HIGH aggregate):**
  - `api/*.go` product files: only 2 of 20 have tests. Zero tests for api.go (Login/Logout/Startup/processHistorySync), message.go (18 funcs), chat.go (16), client.go (10), group.go (17), calls.go, notifications.go, privacy.go, search.go, status.go, auth.go, polls.go.
  - `internal/store/message.go` (53 funcs) only partially covered; `internal/query/*` effectively untested.
  - Frontend: 1 of 8 stores tested (useMuteStore). All hooks and all screens untested.
  - systray/ module: no tests, excluded from root `go test` (nested module).

## 7. Repo hygiene

- `git status` clean; built `whats4linux.exe` (59 MB) at root is **untracked** — `.gitignore:18` `*.exe` covers it (line 19 is a duplicate rule).
- Under `build/`: 8 compiled exe variants incl. "whats4linux - Copy (2..5).exe" (~250 MB) — ignored but bloating the working dir.
- `frontend/node_modules` (157 MB) and `frontend/dist` on disk, not tracked. No tracked file > 5 MB; pack = 2.34 MiB (654 objects) — clean.
- **`.idea/` (6 files) IS tracked** and `.gitignore` doesn't cover `.idea/` — MED.
- `frontend/package.json.md5` committed — expected Wails behavior — fine.
- No `node_modules`/`dist`/`.wails` in `git ls-files` — good.

## 8. scripts/build & scripts/run

- `scripts/build`: POSIX sh; builds systray (per-OS name, `.exe` for MINGW/MSYS/CYGWIN), then `wails build $1`. Works under Git Bash, **not** PowerShell/cmd.
- `scripts/run`: `./scripts/build -debug` then `./build/bin/whats4linux` — hardcoded non-`.exe` name → **fails on Windows** (the binary is `whats4linux.exe`) — MED.
- Neither referenced by README/CI/Nix.

## 9. systray

- NOT dead: separate Go module (`whats4linux_tray`, replace `../`), built by scripts/build + release workflows, launched at runtime (api.go:500 → internal/misc/systray.go:25-32, appends `.exe` on Windows). Caveat: `wails build` alone never produces it → tray launch logs failure (nonfatal). Windows tray never spawns in dev.

## 10. Wails bindings — dead API surface

- 142 exported `Api` methods → 140 JS bindings (`Startup`/`Shutdown` excluded, lifecycle).
- Frontend references ~117 of 140.
- **23 bindings never referenced in frontend/src** (full list in `eval/07-dead-code-inventory.md` §3): incl. `IsLoggedIn`, `ResetConnection`, `WaitForConnection`, `FetchGroups`, `GenerateMessageID`, bot/newsletter read APIs, `RemoveEventHandlers`, `MarkNotDirty`, `StoreLIDPNMapping`, `TryFetchPrivacySettings`, `SetGroupTopic`, `DownloadImageToFile`, `GetCachedImages`, `SetForceActiveDeliveryReceipts`, `NewsletterMarkViewed`, `NewsletterSubscribeLiveUpdates`, `ConnectWithContext`, `GetNewsletterByInvite/GetNewsletterMessageUpdates/GetNewsletterMessages/GetSubscribedNewsletters`, `OnSecondInstanceLaunch` (Wails-internal callback — legit to keep).

## Top-10 tooling/hygiene issues

1. CI Linux build broken (webkit 4.0 vs 4.1 tag).
2. No CI job runs any test (88 tests unexecuted).
3. `tsc` silent no-op in `npm run build`/`wails build`.
4. 23 dead Wails API bindings.
5. Dual lockfiles (pnpm-lock.yaml stale).
6. release.yaml publishes nightly pre-release on every run.
7. Fork drift: module path, README badges/links, wails.json author.
8. Backend coverage gap (2 of 20 api files tested).
9. 7 dead eslint/prettier devDeps + no eslint config + unused react plugin.
10. `.idea/` tracked; ~250 MB stale exe junk on disk; scripts/run broken on Windows.
