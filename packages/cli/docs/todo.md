# TODO

1. Document aggregate options like `--no-git` (and also `--enveloper`)

1. Move commit/add to be part of common logic and not a build step, maybe with a default
   for the commit/add run. It can be phases with defaults.

1. Deal with the scenarion where you `bilt . --no-upto`
   and then that the next build (with `upto`) will continue where the previous left off.

   Idea: using commit times, implement a "make like" check of whether a package needs to be built.
