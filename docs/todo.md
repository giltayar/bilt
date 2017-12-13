# TODO

## Continuation

## CLI and productization

1. Changes due to CLI definition:
   * Support definition of steps in plugin info
   * Support reading bilditrc per-package.
   * Support definition of steps in per-package
   * Support enabling/disabling steps globally. (low priority)
   * Support additional dependencies defined in bilditrc per-package.
   * Support per-package last build info, and kill the whole leveldb plugin.
1. Build the CLI
1. Deal nicely with output
1. Support partial building, e.g. `--root`.
1. Make it a simple global install, available to any who wants it

## Fine Tuning

1. Support npm-docker artifacts
1. Start using it in applitools projects.
1. Make it work in CircleCI with caching the .bildit directory.
1. Enable it to build itself

## Do more testing of packages

1. What she said
1. Also write Readmes for everything

## Parallel Execution

1. Deal with parallel execution:
   * job output collection
   * agents
   * maximum number of agents
1. Can we do parallel execution in CircleCI?

## Future productization

1. Add an auto-upgrade feature
1. Support local-docker-agent and reuse docker containers between builds

## Misc

1. Error handle bad configuration
1. Pull if image not found when running job
1. npm binary runner should not install if package already exists
