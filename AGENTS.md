# AGENTS.md

`@tryghost/deploy` is a [Shipit](https://github.com/shipitjs/shipit) plugin that
deploys internal Ghost projects to servers over SSH. TypeScript compiled to
CommonJS, pnpm, Vitest. See `README.md` for what it does and how consumers use it.

## Commands

```sh
pnpm install              # uses the pinned pnpm (packageManager field) via Corepack
pnpm build                # tsc → dist/ (the published, compiled output)
pnpm typecheck            # tsc --noEmit
pnpm lint                 # oxlint + oxfmt --check
pnpm lint:fix             # oxlint --fix + oxfmt
pnpm test                 # lint + typecheck + unit
pnpm test:unit            # Vitest unit suite, with coverage (gated >=80%)
pnpm test:e2e             # full deploy against throwaway Docker containers
```

## Boundaries — do not break these

- **`lib/deploy.ts` is a runtime contract, not just this repo's tooling.** It
  shells the dependency install command (`yarn` / `npm` / `pnpm install`) on the
  **remote** servers it deploys to, chosen from `shipit.config`. Jenkins-deployed
  services depend on this exact behaviour. Don't "modernise" or change it; the
  unit tests (`yarn install --production`, `npm install`) and the e2e
  `installs lodash` tests exist to pin it. This is separate from how _this_ repo
  builds itself (which is pnpm).
- **Source is TypeScript in `index.ts` / `lib/*.ts`; the published package is the
  compiled `dist/`** (`main`/`types` point there, `files` ships only `dist`).
  `dist/` is gitignored and built by `pnpm build` — in CI, before publish
  (`prepublishOnly`), and inside the e2e runner. Don't edit or commit `dist`;
  change the `.ts` source and rebuild.
- **Node 22.23.4 is a deliberate required floor — `engines: ">=22.23.4"`,
  CI matrix 22.23.4/24.** Local development follows `.nvmrc`.
  The Jenkins jobs run this plugin under a
  per-project Node version (`jenkins-jobs/jobs/apps/projects.yaml`):
  Daisy.js/Zuul/dispatchers/Stats-Service on 22.23.4 (the Ghost(Pro) server
  runtime), Scheduler/UpdateCheck/elastic-alerting on 24 — **but Ghost-Rollout
  on 18.20.2 and AppMonitor on 14.18.1** (legacy Ubuntu 18.04 / glibc 2.27 infra
  that can't run Node 18+; galera-healthcheck and elasticsearch-query-exporter
  are also still listed on 14.18.1). We require 22.23.4 _anyway_: those sub-20
  jobs will **fail to install a new version until the infra team upgrades
  them** (in progress) — a known, accepted tradeoff, not a bug. **Do not lower
  `engines` to "support" Node 14/18.** Raise the floor only when no Jenkins job
  that can run this plugin is left below the new version.
- **`pnpm` is held on the 10.x line** (`packageManager`, Renovate
  `allowedVersions: '<11'`). pnpm 11 needs Node >= 22.13, which the 22.23.4
  floor now satisfies, but the upgrade has not been done yet; move to 11 in its
  own change, not as a side effect of a runtime bump.
- **GitHub Actions must be pinned to full commit SHAs** (org policy rejects
  floating tags — every job fails in seconds otherwise). Keep the `# vX.Y.Z`
  comment next to each SHA.

## Gotchas

- **e2e needs Docker running.** Both images pin Node 22.23.4 to match the Ghost(Pro)
  server runtime; keep these and the exact CI leg protected in Renovate. It builds
  two containers: a `runner` (installs
  _this_ repo's deps with pnpm, runs `pnpm build`, then Vitest against `dist/`)
  and a `target` (the deploy destination — it has npm, yarn, and pnpm available
  so all three runtime install paths can be exercised).
- **The required status check is `Required checks pass`** — an aggregator job that
  `needs: [lint, test, e2e, build]`. Add new required jobs to its `needs` (and to
  the result-count guard in the job), not to branch protection.
- **pnpm consumers must not share `node_modules`.** pnpm can't install into a
  symlinked `node_modules` (`ENOTDIR`); see the README's pnpm/`sharedLinks` note.

## Publishing

Releasing is one command: **`pnpm ship <patch|minor|major>`** (or an exact
version, or no argument for the interactive picker). `ship` is
[`@tryghost/pro-ship`](https://www.npmjs.com/package/@tryghost/pro-ship); the
`preship` hook runs `pnpm test` first and **aborts before any git mutation if
tests fail** (no stranded version commit/tag). On success `pro-ship` bumps
`package.json`, commits and tags `vX.Y.Z`, and `git push --follow-tags`es to
`main` — allowed by the Ghost Foundation ruleset bypass (`always`). `ship` does
**not** publish locally (no `--publish` flag) — see below.

**Publishing runs in CI, not on your machine.** `.github/workflows/publish.yml`
triggers on any push to `main` that changes `package.json` and publishes to npm
via **OIDC trusted publishing** — no npm token is stored. The pushed release
commit is what fires it; the workflow skips (no-op) if that version is already
on the registry, so non-release edits to `package.json` are safe. It runs
`pnpm publish`, which builds `dist/` via `prepublishOnly` and ships only `dist`,
with provenance attestation (public repo). A manual `workflow_dispatch` run is
available and defaults to `--dry-run`.
