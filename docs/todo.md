# TODO

## Support docker agents for each job

1. Make a real job that uses one docker agent and pulls repo from github.
   1. Use it to change repo-build-job to use a binaryRunner.
   1. Now make host-agent and local-docker-agent work with it
   1. Now you can implement remote-docker-agent, which accepts a {repository} and not a {directory}
   1. Implement bildit-here so that if it receives a repo and not a directory, it will use
      remote-docker-agent.

## Tests

1. You're good to go in terms of design - start writing tests
1. And write the test for the artifact-finder cli too
1. And write the design document again

## Dependency Graph Build

1. Deal with parallel execution:
   * job output collection
   * agents
   * maximum number of agents
1. Do dependency check build graph
   1. Deal with errors
1. Add changed files, including changes since last build

## CLI and productization

1. Define a good CLI
1. Build the CLI
   1. Support two use cases:
      * Build from filesystem (with symlinking and all)
      * Build from repo (using published artifacts)
1. Deal nicely with errors
1. Support "agent" plugin and not just "agent:*" plugin (as a general use case)
1. Make it a simple global install, available to any who want it
1. Add an auto-upgrade feature
1. Publish commit should include artifact name
1. Retry push

## Supoprt Circle CI

1. Make it so that it works in Circle CI using regular build
1. Add support for triggered builds

## Misc

1. Error handle bad configuration
1. Retry git push if fails on reject
1. Pull if image not found when running job

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
