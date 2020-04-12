# TODO

1. How do we deal with downstream packages that are built, but their upstream ones haven't?
   (for example because of a bug)

   Ideally, in the next build, we'd want to build all the upstreams from the already built packages.

## Rewrite CLI

1. `--packages` and `--upto` should be either paths, globs, package names, or `*` to designate
   all package names, searched. The check and conversion should stop being done as part of yargs
   validation.
1. packages in biltrc are relative to it.
1. parallel testing
1. Build steps come from biltrc.
1. Write documentation in readme.
