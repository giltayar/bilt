# TODO

## Continuation

* bildit-here test fails after config refactoring changes. Fix it.

## CLI and productization

1. Changes due to CLI definition:
   * Change format of pimport configuration to have a `package` key for which package to use, and not
     the elaborate sub-object we use today. This will enable users to override stuff there without
     knowing which package to use.
   * pimport should normalize before merging pluginLists
   * Change `agentCommander:*` to `commands:*`.
   * Support additional dependencies defined in bilditrc per-package.
   * Support per-package last build info, and kill the whole leveldb plugin.
   * Kill all cases of git push. Determine package version the bibuild way.
   * Support reading bilditrc per-package.
   * Support definition of steps
   * Support enabling/disabling steps globally.
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
