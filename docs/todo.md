# TODO

## Feature complete local build

1. Add changed files (whichever git says were changed, no makefile support)

## Local build should use the restartable thingie

1. What she said
1. Do dependency check build graph
1. Add changed files, including changes since last build
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
