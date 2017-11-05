# TODO

## Continuation

## CLI and productization

1. Changes due to CLI definition:
   * Support reading bilditrc per-package.
   * Support additional dependencies defined in bilditrc per-package.
   * Support definition of steps
   * Support enabling/disabling steps globally.
   * Support per-package last build info, and kill the whole leveldb plugin.
   * Kill all cases of git push. Determine package version the bibuild way.
   * Kill all appConfig usage in builders.
1. Build the CLI
1. Deal nicely with output
1. Support partial building, e.g. `--root`.
1. Make it a simple global install, available to any who wants it

## Fine Tuning

1. Publish commit should include artifact name
1. Support npm-docker artifacts
1. Check that it really works in CircleCI
1. Dogfood and use it also in applitools projects.

## Parallel Execution

1. Deal with parallel execution:
   * job output collection
   * agents
   * maximum number of agents

## Do more testing of packages

1. What she said
1. Also write Readmes for everything

## Future productization

1. Add an auto-upgrade feature
1. Support local-docker-agent and reuse docker containers between builds

## Misc

1. Error handle bad configuration
1. Pull if image not found when running job
1. npm binary runner should not install if package already exists
