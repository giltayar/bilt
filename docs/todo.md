# TODO

## Feature complete local build

1. Same build, but all plugins come from config file.
1. Build a multi-package build, first without checking for dependencies and changelist, and list of packages
   and build order come from a list file on root or something.
1. Enable npm-link-ing in local
1. Add discovery of packages, but still no dependency check
1. Do dependency check build graph
1. Add changed files (whichever git says were changed, no makefile support)

## configuration of plugins starting to work

1. Same, but with a docker agent, to test plugability
