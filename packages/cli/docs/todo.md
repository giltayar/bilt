# TODO

1. Deal with the scenarion where you `bilt . --no-upto`
   and then that the next build (with `upto`) will continue where the previous left off.

   Idea: using commit times, implement a "make like" check of whether a package needs to be built.

1. Support deploy:
   1. Are builtin options (i.e. `--dry-run`) available as `BILT_OPTION_DRY_RUN`? They should be
   1. Send biltin.cli.options() exposes the cli options, to enable us to condition based on
      a combination of options, and to expose env variables based on the options
      (`KDEPLOY_COMMAND`).
   1. `jobs` in biltrc should be the list of jobs (so then you can just copy/paste from a build
      configuration), and `options` should be what `jobs` is now.
   1.

1. Move commit/add to be part of common logic and not a build step, with a default
   for the commit/add run (so `deploy` can override the commit message).

1. Output as github actions workflow

