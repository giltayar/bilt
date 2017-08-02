# TODO

## Feature complete local build

1. If `package.json` was not changed, no need to do `npm install`
1. Add `.bilditignore` to solve problem of build artifacts that are in source control (e.g. package-lock.json)

## Local build should use the restartable thingie

1. What she said

## Dependency Graph Build

1. Do dependency check build graph
1. Add changed files, including changes since last build

## CLI and productization

1. Define a good CLI
1. Build the CLI
1. Make it a simple global install, available to any who want it
1. Add an auto-upgrade feature?

## Support docker agents for each job

1. Same, but with a docker agent, to test plugability, except the repo-build
1. Now with the repo build
1. Add publishing
1. Add parallelization

## Supoprt Circle CI

1. Make it so that it works in Circle CI

## Use Cases

* Local build.
  * This can theoretically run in Travis/Circle.
  * Support changed files
* Local build that works on a repo, and uses docker/kubernetes to run builds.
  * Web api to check the results/logs
  * console api to check the results/logs
  * Supports publishing
* Travis/Circle CI build that use build triggering to run builds.
