# TODO

1. How do we deal with downstream packages that are built, but their upstream ones haven't?
   (for example because of a bug)

   Ideally, in the next build, we'd want to build all the upstreams from the already built packages.

## Rewrite CLI

1. `[packages]` are the packages that will be built. If none, it does like today. But if there
   are packages, then no packages are searched for, and they are the only packages that are taken
   into consideration.
1. `--upto` packages will be also added to `packages`
1. The best and easiest configuration for a monorepo subset is to define no packages (and thus
   let bilt take care of finding them), but to specify the top-level packages of the subset as
   `--upto`. That way, all packages from a project will be taken into consideration, and the others
   ignored.
1. A quick way to build current package is `bilt`.
1. There should be `--no-git`, `--no-publish`, `--no-push`, `--no-commit`,
   `--no-pull`, `--no-audit`, `--no-test`... options
1. `biltrc` should allow defaults for all CLI options.
1. `--packages` and `--upto` should be either paths, globs, package names, or `*` to designate
   all package names, searched.
1. We should `chalk` the beginning and end of each build, just like we did in the previous CLI.
1. Enable `bilt run ... --upto --no-git -- command args...`
