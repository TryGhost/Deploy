# Deploy

Set of deployment tasks for Shipit in combination with internal Ghost projects.

# Install

Install this package:

`npm install ghost-deploy --save`

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
    "shipit": "shipit"
  },
```

# Usage

## Deploy

To deploy a project to the server configured as staging execute the following command:

`npm run shipit <environment> <task>`

Example: `npm run shipit staging deploy`

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

The example shows how to execute the pwd command on the remote server. Visit https://github.com/shipitjs/shipit for more information about how to write custom tasks.

## Events

`ghost-deploy` emits one event (`deployed`) at the moment. This event can be used to trigger follow up actions to a successful deployment. The following example shows how the `pwd` command can be executed when the `deployed` event is emitted.

```
function init(shipit) {
  require('ghost-deploy')(shipit);

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

