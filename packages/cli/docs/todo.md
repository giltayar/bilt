# TODO

1. How do we deal with downstream packages that are built, but their upstream ones haven't?
   (for example because of a bug)

   Ideally, in the next build, we'd want to build all the upstreams from the already built packages.

## Rewrite CLI

1. A quick way to build current package is `bilt .`.
1. There should be `--no-git`, `--no-publish`, `--no-push`, `--no-commit`,
   `--no-pull`, `--no-audit`, `--no-test`... options
1. `biltrc` should allow defaults for all CLI options.
1. `--packages` and `--upto` should be either paths, globs, package names, or `*` to designate
   all package names, searched. The check and conversion should stop being done as part of yargs
   validation.
1. We should `chalk` the beginning and end of each build, just like we did in the previous CLI.
1. Enable `bilt run ... --upto --no-git -- command args...`
