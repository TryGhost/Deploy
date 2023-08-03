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
- `yarn lint` runs eslint

### Publish
- `yarn ship`

# Copyright & License

Copyright (c) 2013-2023 Ghost Foundation - Released under the [MIT license](LICENSE). Ghost and the Ghost Logo are trademarks of Ghost Foundation Ltd. Please see our [trademark policy](https://ghost.org/trademark/) for info on acceptable usage.

