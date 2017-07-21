# TODO

## Feature complete local build

1. Build a multi-package build, using artifact-walker
    1. integrate artifact-walker into bildit
       1. Use agentFunctions instead of `fs`
    1. Make tests run again
1. Enable npm-link-ing in local
1. Add discovery of packages, but still no dependency check
1. Do dependency check build graph
1. Add changed files (whichever git says were changed, no makefile support)

## configuration of plugins starting to work

1. Same, but with a docker agent, to test plugability
