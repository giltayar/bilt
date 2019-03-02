# TODO

## Continuation

## CLI and productization

1. Support running just a single step
1. When updating dependencies, we change package-lock.json, which generates a rebuild.
   We should fix this by making the update command say that the post save should take the `package-lock.json` into account.
   * Similar for publish?
1. Support running a command
1. Support building without marking as built (so I can reinstall without it thinking everything is fine),
   and make it the default when disabling any step
1. Make the output of bilt test output be tty
1. Support `allOutput` from CLI
1. Support parallel builds
1. Add times for each step
