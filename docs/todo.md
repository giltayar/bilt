# TODO

## Support docker agents for each job

1. Use a docker agent, to test plugability
1. Add docker package type
1. Add publishing

## Dependency Graph Build

1. Deal with errors
1. Deal with parallel execution, especially regarding job output collection
1. Do dependency check build graph
1. Add changed files, including changes since last build

## CLI and productization

1. Define a good CLI
1. Build the CLI
1. Make it a simple global install, available to any who want it
1. Add an auto-upgrade feature

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
