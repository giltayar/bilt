# TODO

1. How do we deal with downstream packages that are built, but their upstream ones haven't?
   (for example because of a bug)

   Ideally, in the next build, we'd want to build all the upstreams from the already built packages.

## Rewrite CLI

1. Build steps come from biltrc.
1. Ensure (and test that)`--force` should build dependent packages
1. Add `--assume-changed` that assumes a package was changed (but does not build it), so that
   other pacakges that depend on it will be built. This is good for a scenario where you
   first built a package with `--no-upto` and then regretted it, and wanted to build all its
   uptos.
