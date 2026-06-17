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
- **Node 20.20.0 is a deliberate required floor — `engines: ">=20.20.0"`,
  `.nvmrc`, CI matrix 20.20.0/22/24.** The Jenkins jobs run this plugin under a
  per-project Node version (`jenkins-jobs/jobs/apps/projects.yaml`): Daisy.js,
  Zuul, Stats-Service and the dispatchers on 20.20.0, Scheduler/UpdateCheck on
  24 — **but Ghost-Rollout on 18.20.2 and elastic-alerting/AppMonitor on
  14.18.1** (legacy Ubuntu 18.04 / glibc 2.27 infra that can't run Node 18+).
  We require 20.20.0 _anyway_: those sub-20 jobs will **fail to install a new
  version until the infra team upgrades them** (in progress) — a known, accepted
  tradeoff, not a bug. **Do not lower `engines` to "support" Node 14/18.**
- **`pnpm` is pinned to the 10.x line** (`packageManager`) on purpose — pnpm 11
  requires Node >= 22.13 and would break the 20.20.0 CI leg. Don't bump it to 11
  until the floor moves off Node 20.
- **GitHub Actions must be pinned to full commit SHAs** (org policy rejects
  floating tags — every job fails in seconds otherwise). Keep the `# vX.Y.Z`
  comment next to each SHA.

## Gotchas

- **e2e needs Docker running.** It builds two containers: a `runner` (installs
  _this_ repo's deps with pnpm, runs `pnpm build`, then Vitest against `dist/`)
  and a `target` (the deploy destination — it has npm, yarn, and pnpm available
  so all three runtime install paths can be exercised).
- **The required status check is `All tests pass`** — an aggregator job that
  `needs: [lint, test, e2e, build]`. Add new required jobs to its `needs` (and to
  the result-count guard in the job), not to branch protection.
- **pnpm consumers must not share `node_modules`.** pnpm can't install into a
  symlinked `node_modules` (`ENOTDIR`); see the README's pnpm/`sharedLinks` note.

## Publishing

`pnpm ship` runs the tests then `pnpm publish && git push --follow-tags`. Unlike
the old `yarn publish`, `pnpm publish` does **not** bump the version — run
`pnpm version <patch|minor|major>` first (it writes the tag), then `pnpm ship`.
