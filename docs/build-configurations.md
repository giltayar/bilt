# Build configurations

In which we define precisely what [build configurations](./concepts.md#build-configurations)
are, and how to use them.

## What are build configurations

A build configuration defines the different jobs that can be executed on a monorepo. For example,
"build" jobs, and "deploy" jobs. If not specified in the Bilt cli, the "build" job is executed.

See [build configurations](./concepts.md#build-configurations) for a more precise definition of
build configurations.

## Using build configurations

The build configuration is defined in the `.biltrc.json`, in the property
[`jobs`](./reference.md#configuration-file).

When using the CLI, it will by default use the job `build` from the build configuration, unless you
use another command, like:

```sh
bilt deploy ./ms-a
```

Which runs the `deploy` job in your build configuration.

## Build configuration reference

This is a reference to the build configuration object. You can see the definition
in Typescript (as embedded in JSDoc) [here](./packages/build-with-configuration/src/types.js).

### The `BuildConfiguration` object

* A build configuration is a JSON object with the following properties:

* `jobs`: a `Jobs` object.
* `extends`: a path to a file that is another build configuration. The CLI will look for a job in
  the `extends` build configuration if it is not found in the main one (the file will be loaded
  using [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig), just like all configuration
  files).

  The special string value `#default` means that this build configuration extends the
  [default](#the-default-build-configuration) one.

### The `Jobs` object

An object who's keys are `jobId`-s, and who's values are `Job` objects.

* `jobId`-s. Any string is OK, but they are referenced from the command line, so they are
  typically "standard simple ASCII with no weird characters".

  When using the `bilt` CLI, you can specify the job to run by specifying its `jobId`. If not
  specified, `bilt` runs the job under the "`build`" `jobId`.

## The `Job` object

An object with the following properties:

* `steps`: an object with three optional properties:
  `before`: an array of `Step` objects defining the steps to execute _before_ building all the
  packages (but only if there are any packages to build)
  `after`: an array of `Step` objects defining the steps to execute _after_ building all the
  packages (but only if at least one of the packages built succesfully)
  `during`: the steps to run for each package. These are the steps for the ["package build"](./concepts.md#build)

### The `Step` object

An object with the following properties:

* `name`: the name of the step (will be shown in the CLI before running the step)
* `run`: the shell command to execute for the step
* `enableOption`: a string, or an array of two strings that defines the CLI options that
  enable or disable this step (the default is `true`: to enable). The first option (or only one) is
  the option itself, and the second one is the aggregate option. The first option overrides the
  aggregate option, if it is set, and has the aggregate option if it is not set. If none are set,
  the default is `true`. The final run command will receive the option as environment variables
  in the form of `BILT_OPTION_${constantCase(option)}` with a value of `true` (as a string), but
  if the final value of the option is false, the environment variable will not be set at all.

  It is illegal for an option to appear in two steps with different aggregate options.

* `parameterOption`: a string, or an array of strings, that define parameters to be passed to the
  `run` command. The `run` command will receive them in the form of
  `BILT_OPTION_${constantCase(option)}`, e.g. a parameter option `foo-bar` will be passed as
  `BILT_OPTION_FOO_BAR`.
* `condition`: can be:
  * A boolean: defines whether to execute this step or not.
  * A function: [evaluated](#evaluating-functions-inside-the-build-configuration) whose return
    defines whether to execute this step or not. Passing a function is available only
    when the build configuration is a JS module.
  * A string: `eval`-ed and assumed to be a function that is
    [evaluated](#evaluating-functions-inside-the-build-configuration) whose return
    defines whether to execute this step or not.
* `env`: an object that defines additional environment variables passed to the `run` command.

  The key is the environment variable name, and the value can be:
  * A string: defines the environment variable value.
  * A function: [evaluated](#evaluating-functions-inside-the-build-configuration) whose return
    defines the environment variable value. Passing a function is available only
    when the build configuration is a JS module.
  * An object with a `function` string property: `eval`-ed and assumed to be a function that is
    [evaluated](#evaluating-functions-inside-the-build-configuration) whose return
    defines the environment variable value.

### Evaluating functions inside the build configuration

A function that is evaluated for any purpose in the build configuration is evaluated thus:

* It is treated as an async function, but sync functions are OK too.
* It is passed an object with the following properties:
  * `directory`: the directory (full path) of the package, or in the case of steps in
    the `before` or `after` phases, the root directory (full path) of the monorepo.
  * `biltin`: an object that includes builtin helper functions ("biltin", get it?) that
    can help your steps. The `biltin` object is structured as a set of namespaces with functions
    in them. Each namespace is an object where each property is a function. Currently, the only
    namespace is `npm`, and it includes the following functions:
    * `nextVersion`: an async function that accepts a directory of a package and returns the
      next version of the package, as defined [here](./how-bilt-works.md#version-increment-how).

## Sample Build Configuration with all the features

```yaml
jobs:
  build:
    steps:
      before:
        - name: 'git pull'
          enableOption: ['pull', 'git']
          run: 'git pull --rebase --autostash'

      after:
        - name: 'git commit'
          enableOption: ['commit', 'git']
          parameterOption: 'message'
          run: 'git commit --allow-empty -m "$BILT_OPTION_MESSAGE"'

      during:
        - name: 'npm install'
          enableOption: 'install'
          run: 'npm install'
        - name: 'increment version'
          enableOption: 'publish'
          run: "npm version $NEXT_VERSION --allow-same-version --no-git-tag-version"
          env:
            NEXT_VERSION:
              function: |
                async ({directory, biltin}) => {
                  return await biltin.npm.nextVersion(directory)
                }
        - name: 'test'
          run: 'npm run test'
          enableOption: 'test'
          condition:
            function: |
              async ({directory}) => {
                const packageJson = JSON.parse(await require('fs').promises.readFile(directory + "/package.json"))

                return (packageJson.scripts || {}).test
              }
        - name: 'npm publish'
          enableOption: 'publish'
          run: 'npm publish --access=$ACCESS'
          condition:
            function: |
              async ({directory}) => {
                const packageJson = JSON.parse(await require('fs').promises.readFile(directory + "/package.json"))

                return !packageJson.private
              }
          env:
            ACCESS:
              function: |
                async ({directory}) => {
                  const packageJson = JSON.parse(await require('fs').promises.readFile(directory + "/package.json"))

                  const isPublic = (packageJson.publishConfig || {}).access !== 'restricted'

                  return isPublic ? 'public' : 'restricted'
                }
        - name: 'stage files'
          enableOption: ['stage']
          run: 'git add .'
```

## The default build configuration

This describes what the default build configuration does. For the exact build configuratin
file, see [here](./packages/build-with-configuration/src/default-build.yaml).

Before all of the package builds:

1. `git pull --rebase --autostash`: to pull all changes from the remote repository before building.

For each package:

1. `npm install` ensures all dependencies are installed
1. `npm update` updates all the dependencies.
    This is especially important in Bilt moonorepos, as it updates
    the dependencies to the other packages in the monorepo. Without `npm update`, packages
    will have outdated dependencies on the other packages in a monorepo.
1. _Increment_ version: to update the version of the package so it can be published.
   See [this](./how-bilt-works.md#version-increment-how) for more information.
1. `npm audit fix`. Because we're security conscious!
   (See [Snyk](https://snyk.io) for a more powerful alternative.)
1. `npm run build`: build the source code. For example transpile the code, bundle it,
   or build a docker image. This runs only if a `build` script exists in the `package.json`.
1. `npm test`: because we have tests, right? 😉 Will skip if no `test` script exists
1. `npm publish`: publishes the package

After this, Bilt also runs `git add .` to add all the files to be commited.

After all of the package builds:

1. `git commit -m "commit message"`: commit all the added files (with the addition of the
   `[bilt artifacts]` text to the commit message, as described above).
2. `git push`: pushes changes to the remote repository.

### Build options for default build configuration

All of these build options have a default of `true`, and are the options specified in the
default build configuration

* `--pull`: enables disables "pull" when building
* `--push`: enables disables "push" when building
* `--commit`: enables disables "commit" when building
* `--install`: enables disables "install" when building
* `--update`: enables disables "update" when building
* `--audit`: enables disables "audit" when building
* `--build`: enables disables "build" when building
* `--test`: enables disables "test" when building
* `--publish`: enables disables "publish" when building
* `--git`: no-git disables push/pull/commit together, unless they are explicitly specified in the
  command line
