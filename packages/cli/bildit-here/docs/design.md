# bildit-here Design

## Use Cases

* Build from filesystem (with symlinking and all), with changed files support
* Build specific commit/branch in repo (using published artifacts),
  for use in CI, with last-succesful-build support

## Installing

```sh
npm install -g @bildit/bildit
```

## CLI Command

```sh
bildit [<folder>|<repo>] [options...] [-- cmd args...]
```

Options:

* `<folder>|<repo>`: what to build. Can be a folder or a git repository.
* `--directory | -d`: the directory to use if not specified. Defaults to `.`.
* `--repository`: the repository to use if not specified. \
  Defaults to nothing locally or
  to the value in the appropriat env variable (e.g. `CIRCLE_REPOSITORY_URL` in CircleCI)
* `--branch`: the branch to build and store last successful build info for.
              Defaults to current branch if directory, or `master` if repository.
  * If the branch is a commithash, then everything will be built, and no last succsful build info will be saved.
* `--build=<artifact-name> | -b <artifact-name>`: build only this artifact. Can be multiple of these.
* `--root=<artifact-name> | -r <artifact-name>`: build this artifact, everything needed to build it,
  and all artifacts that depend on it, recursively (in the correct order). Can be multiple of these.
* `--upto=<artifact-name> | -u <artifact-name>`: build this artifact, and everything needed to build it
  (in the correct order).
* `--force | -f`: defaults to false. force building all needed artifact, whether they need to be built or not.
* `--disable-step=<step> | -d <step>`. What it says.
* `--enable-step=<step>`. What it says.
* `--step=<step> | -s <step>`: run only this step. Can be multiple of these
* `--execute-with=local|docker`: defaults to local. Whether to run all steps in a process or inside a docker container.
* `--output` | `-o`: Which output to show. Defaults to `step-failure`.
  * `step-failure`: show only outputs of steps that have failed.
  * `artifact-failure`: show only outputs of all steps in a build that has failed.
  * `all`: show output of everything, as it happens.
* `-- cmd args...`: run this command (with args) in each artifact directory, instead of building.

## artifact `.artifactrc.json`

Each artifact can hold a `.artifactrc.json`, `.artifactrc.yaml` (or `artifact.config.js` if you're into exporting a module)
that has the following format:

```yaml
artifact:
  name: alternative-name-that replaces auto-recognized name according to regular rules
  dependencies:
    - dependencies
    - that
    - are in addition to auto-recognized ones
  steps: # these steps will replace the built-in steps defined by the plugin for the language
    - command to execute using bash
    - [command,to,execute,raw]
    - name: name of step to run
      id: the id of the build-step to be used in disable-build-step
      command: just-like-run
      condition: steps.build || steps.install # will be eval-ed with a steps object
                                              # that includes booleans for each of the steps
    - build-or-test-or-any-other-default-step # use this to insert one of the built-in steps of the plugin
```

## Changed Files

* bildit stores information about the last succesful build of each artifact, _per branch_.
* It will store this commithash in the `.bildit/succesful-builds/<branch>/<artifact-name>`
* If there are uncommitted files that were succesfully built from, their checksum will be stored in:
  `.bildit/succesful-builds/<branch>/<artifact-name>.uncommitted.json` as
  ```json
  {"filepath-relative-to-build-dir": "hash-of-file-content", "...": "..."}
  ```

### artifact `.bilditignore`

* A file will be checked for changes only if it is not gitignored (i.e. it is a source file), and
  it is not bilditignored using an optional `.bilditignore` file in the corresponding archive directory.

## Root `.bilditrc.json`/`bildit.config.js`

* This file defines the plugins that bildit will use to run the build.
* Usually, you don't need to define one, unless you need to authenticate git or npm.
* You can also override the default build steps globally for all artifacts in the repo.
* If you do, you will need a file that looks something like this:

```js
const fs = require('fs')
const path = require('path')

module.exports = {
  plugins: {
    'commands:npm': {
      npmAuthenticationLine: '//localhost:4873/:_authToken="NPM_TOKEN"',
    },
    'commands:git': {
      gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
      gitUserEmail: 'gil@tayar.org',
      gitUserName: 'Gil Tayar',
    },
    'builder:npm': {
      steps: {
        [
          'npm install',
          ['npm', 'run', 'build'],
          {
            id: 'test'
            name:'Test',
            command: ['npm', 'test']
          }
        ]
      },
      access: 'restricted'
    },
  },
}
```