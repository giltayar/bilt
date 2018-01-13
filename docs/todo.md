# TODO

## Continuation

## CLI and productization

1. Changes due to CLI definition:
   * Support per-package last build info
     * kill the whole leveldb plugin, including the aborted job shit
     * The .bilt folder will have folders for all packages (in same structure as in the repo)
       * Each such folder will have a last-succesful-build.json, with:
         * commithash
         * list of files changed from commithash, along with their sha1.
       * cli will read the information from the .bilt folder and construct the information.
       * It will correlate it with the information that it reads from git and repo to figure out which files and packages
         changed, and send that information, along with the package dependencies, to the repo-build-job
   * Support enabling/disabling steps globally. (to support publishing, cli, or not publishing, dev)
1. Build the CLI
1. Deal nicely with output
1. Support partial building, e.g. `--root`.
1. Make it a simple global install, available to any who wants it

## Fine Tuning

1. Support npm-docker artifacts
1. Start using it in applitools projects.
1. Make it work in CircleCI with caching the .bilt directory.
1. Enable it to build itself

## Do more testing of packages

1. What she said
1. Test build failures
1. Test linking local packages
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
