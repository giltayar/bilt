# TODO

## Continuation

* Confusion between buildir and the server's git repo. Both need to be temporary
* npm publish says:

```error
bildit:host-agent dispatching command [ 'npm', 'publish', '--access', 'public' ] in directory /var/folders/rh/t426py3x5rn2d885tc704tcw0000gn/T/replay-git-repo97KQO3 +4s
npm ERR! publish Failed PUT 403
npm ERR! code E403
npm ERR! unregistered users are not allowed to publish package a : a

npm ERR! A complete log of this run can be found in:
npm ERR!     /var/folders/rh/t426py3x5rn2d885tc704tcw0000gn/Tf2UpI5/.npm/_logs/2017-09-15T15_14_41_256Z-debug.log
Error: Command failed with errorcode 1
    at ChildProcess.process.on.code (/Users/giltayar/code/bildit/packages/agents/host-agent/src/host-agent.js:39:34)
    at emitTwo (events.js:125:13)
    at ChildProcess.emit (events.js:213:7)
    at maybeClose (internal/child_process.js:927:16)
    at Process.ChildProcess._handle.onexit (internal/child_process.js:211:5```
```

## Tests

1. You're good to go in terms of design - start writing tests
   * E2E test publishing in host-agent
   * E2E Test local-docker-agent
   * E2E Test remote-docker-agent
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
      * Build from filesystem (with symlinking and all), with changed files support
      * Build from repo (using published artifacts), for use in Travis CI, with last-succesful-build support
1. Deal nicely with errors
1. Make it a simple global install, available to any who want it
1. Add an auto-upgrade feature
1. Publish commit should include artifact name
1. Retry push

## Do more testing of packages

1. What she said

## Future productization

1. Add an auto-upgrade feature
1. Support local-docker-agent and reuse docker containers between builds

## Supoprt Circle CI

1. Make it so that it works in Circle CI using regular build
1. Add support for triggered builds

## Misc

1. Error handle bad configuration
1. Retry git push if fails on reject
1. Pull if image not found when running job
1. npm binary runner should not install if package already exists

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