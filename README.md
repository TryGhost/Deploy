# Deploy

Set of deployment tasks for Shipit in combination with internal Ghost projects.

# Install

Install this package:

`npm install @tryghost/deploy --save`

Add a `shipitfile.js` config with the following content. Keep in mind that it is never a good idea to commit private credentials to git. Private settings could for example be provided by using environment variables (`process.env.ENV_VARIABLE`).

```
function init(shipit) {
  require('ghost-deploy')(shipit);

  shipit.initConfig({
    default: {
      workspace: './deploy',
      deployTo: '/opt/deploy_to',
      ignores: ['.git', 'node_modules'],
      sharedLinks: [{
        name: 'node_modules',
        type: 'directory'
      }, {
        name: 'config.production.json',
        type: 'file'
      }]
    },
    staging: {
      servers: '<user>@<server>'
    }
  });

  ...

}
module.exports = init;
```

And add a new script to your package.json file:
```
  "scripts": {
    ...,
    "deploy": "shipit"
  },
```

# Package manager

By default the deploy runs `yarn install --production` on the server. Choose a
different package manager with the `packageManager` config option:

```
shipit.initConfig({
  default: {
    // ...
    packageManager: 'pnpm' // 'yarn' (default) | 'npm' | 'pnpm'
  }
});
```

- `npm` is bundled with Node, so it is always present on the server. `yarn`
  (the default) is not part of Node but is commonly preinstalled (e.g. in the
  official Node Docker images); `pnpm` usually is not. Whichever manager you
  choose must be available on the server, or the install step fails (Corepack or
  a global install can provide yarn/pnpm). The legacy `npm: true` flag still
  works (equivalent to `packageManager: 'npm'`); `packageManager` takes
  precedence if both are set.
- `allDeps: true` installs dev dependencies too (drops the production-only flag:
  `--production` for yarn/npm, `--prod` for pnpm).

### pnpm and `sharedLinks`

Do **not** list `node_modules` in `sharedLinks` when using pnpm. pnpm cannot
install into a symlinked `node_modules` (it fails with `ENOTDIR`), and its
content-addressable store already hardlink-dedupes packages across releases, so
sharing `node_modules` is both unsupported and unnecessary. Share only files
such as config:

```
sharedLinks: [{name: 'config.production.json', type: 'file'}]
```

# Usage

## Deploy

To deploy a project to the server configured as staging execute the following command:

`yarn deploy <environment>`

Example: `yarn deploy staging` 

## Custom Tasks

If you need special tasks within your project it is possible to add new task in `shipitfile.js`.

```
function init(shipit) {
  require('ghost-deploy')(shipit);

  ...

  shipit.task('pwd', function () {
    return shipit.remote('pwd');
  });

}
module.exports = init;
```

You would then execute this task using

`yarn deploy <environment> <task>`

E.g.

`yarn deploy staging pwd`

(Note: deploy is the default task, so by default you don't have to provide a task)

The example shows how to execute the pwd command on the remote server. Visit https://github.com/shipitjs/shipit for more information about how to write custom tasks.

## Events

`Deploy` emits one event (`deployed`) at the moment. This event can be used to trigger follow up actions to a successful deployment. The following example shows how the `pwd` command can be executed when the `deployed` event is emitted.

```
function init(shipit) {
  require('@tryghost/deploy')(shipit);

  ...

  shipit.on('deployed', function () {
    return shipit.remote('pwd').then(function () {
      shipit.log('Done!');
    });
  });

}
module.exports = init;
```

Use cases for events are for example database migrations that are executed after deploying new code.

## Development
### Testing
- `pnpm lint` runs eslint

### Publish
- `pnpm ship`

# Copyright & License

Copyright (c) 2013-2023 Ghost Foundation - Released under the [MIT license](LICENSE). Ghost and the Ghost Logo are trademarks of Ghost Foundation Ltd. Please see our [trademark policy](https://ghost.org/trademark/) for info on acceptable usage.

