# TODO

## Small Issues

* Write a test for `symlink` package

## Continuation

## CLI and productization

1. How to make link, publish, increment-version not so low-level steps
1. Deal nicely with output
1. Make it a simple global install, available to any who wants it

## Fine Tuning

1. Start using it in applitools projects.
1. Add "tags" so that we can enable/disable based on tags (e.g. "local", "ci"...)
1. agent instances should have a buildDir, and everything should be relative to that (at least by default).
1. Enable it to build itself
1. Show error if there are circular dependencies. Or maybe build the one with the less dependencies

## Do more testing of packages

1. What she said
1. Test build failures
1. Test linking local packages
1. Also write Readmes for everything
1. Test buildig where the -b is a directory that contains many packages


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
