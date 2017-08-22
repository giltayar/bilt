# TODO

## Support docker agents for each job

1. Use a docker agent, to test plugability. Make every job have its own container
1. Make a real job that uses one docker agent and pulls repo from github.
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

## Misc

1. Error handle bad configuration

## Use Cases

* Local build.
  * This can theoretically run in Travis/Circle.
  * Support changed files
  * Support docker or host agents
    * maximum number of parallel agents is configurable
* Travis/Circle/CI build
  * Pulls from a repo
  * Support changed files
  * Support docker, host, or kubernetes agents
    * maximum number of parallel agents is configurable
* Local build that works on a repo, and uses docker to run builds.
  * Web api to check the results/logs
  * console api to check the results/logs
  * maximum number of parallel agents is configurable
* Travis/Circle build that use build triggering to run builds.
* Simple one job repo build (no monorepo - just build the damn thing from root)
