# TODO

1. Test build steps come from biltrc.
1. Test options come from build steps
1. Test running different jobs
1. `--no-envelope`, `--no-before`, `--no-after`
1. Define and implement semantics of the likes of `--no-git` (and `--no-envelope`)
1. Deal with the scenarion where you `bilt . --no-upto`
   and then that the next build (with `upto`) will continue where the previous left off.

   Idea: when commiting the first build (the one with `--no-upto`), add to `[bilt artifacts]` the
   list of packages that _should_ have been built, but haven't.
1. (Do we still need this?) Add `--assume-changed` that assumes a package was changed (but does not
   build it), so that other pacakges that depend on it will be built. This is good for a scenario
   where you first built a package with `--no-upto` and then regretted it, and wanted to build all
   its uptos.
