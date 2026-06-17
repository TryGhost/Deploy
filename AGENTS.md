# AGENTS.md

`@tryghost/deploy` is a [Shipit](https://github.com/shipitjs/shipit) plugin that
deploys internal Ghost projects to servers over SSH. CommonJS Node, pnpm,
Vitest. See `README.md` for what it does and how consumers use it.

## Commands

```sh
pnpm install              # uses the pinned pnpm (packageManager field) via Corepack
pnpm lint                 # oxlint + oxfmt --check
pnpm lint:fix             # oxlint --fix + oxfmt
pnpm test                 # lint + unit
pnpm test:unit            # Vitest unit suite, with coverage (gated >=80%)
pnpm test:e2e             # full deploy against throwaway Docker containers
```

## Boundaries — do not break these

- **`lib/deploy.js` is a runtime contract, not just this repo's tooling.** It
  shells the dependency install command (`yarn` / `npm` / `pnpm install`) on the
  **remote** servers it deploys to, chosen from `shipit.config`. Jenkins-deployed
  services depend on this exact behaviour. Don't "modernise" or change it; the
  unit tests (`yarn install --production`, `npm install`) and the e2e
  `installs lodash` tests exist to pin it. This is separate from how _this_ repo
  builds itself (which is pnpm).
- **Node 20.20.0, 22, and 24 must all keep working.** 20.20.0 is the floor, not
  a guess: the consumers deployed by this tool — `daisy.js`, `zuul`,
  `stats-service`, and the other Jenkins-deployed services — run on Node 20.20.0
  on the core server, so the plugin has to keep working on that exact runtime.
  It's encoded in `engines`, `.nvmrc`, and the CI matrix (which also covers 22
  and 24 for headroom). **pnpm is pinned to the 10.x line** (`packageManager`) on
  purpose — pnpm 11 requires Node >= 22.13 and would break the 20.20.0 leg. Don't
  bump it to 11 until the core server moves off Node 20.
- **GitHub Actions must be pinned to full commit SHAs** (org policy rejects
  floating tags — every job fails in seconds otherwise). Keep the `# vX.Y.Z`
  comment next to each SHA.

## Gotchas

- **e2e needs Docker running.** It builds two containers: a `runner` (installs
  _this_ repo's deps with pnpm and runs Vitest) and a `target` (the deploy
  destination — it has npm, yarn, and pnpm available so all three runtime install
  paths can be exercised). No Docker → `pnpm test:e2e` can't run.
- **The required status check is `All tests pass`** — an aggregator job that
  `needs: [lint, test, e2e]`. Add new required jobs to its `needs`, not to branch
  protection.
- **pnpm consumers must not share `node_modules`.** pnpm can't install into a
  symlinked `node_modules` (`ENOTDIR`); see the README's pnpm/`sharedLinks` note.

## Publishing

`pnpm ship` runs the tests then `pnpm publish && git push --follow-tags`. Unlike
the old `yarn publish`, `pnpm publish` does **not** bump the version — run
`pnpm version <patch|minor|major>` first (it writes the tag), then `pnpm ship`.
