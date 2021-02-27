# Design of cli

This is where we describe how the CLI works.

it all starts with `run-bilt.js`

## `src/run-bilt.js`

This file is the file that is run when you write `bilt` in the command line. It is a simple
wrapper that runs the main function in `cli.js` and exits on error. Nothing interesting here.

Let's continue to the more interesting file: `bilt.js`.

## `src/bilt.js`

This really is the main file, and the entry point to everything. It mostly runs yarg, giving
it all the command line option, and then executes the build command using `src/command-build.js`.

This is not a usual "yargs" execution, because the usual "yargs" style is to create a yargs
configuration that describes all the CLI arguments and options, and then get yargs to parse the
CLI and get those options and arguments. But in Bilt case, the options and commands are
configurable via the `.biltc` configuration, so the first thing to do is to find the `.biltrc`
(using `findConfig`) and read it using `findBuildConfiguration`.

Once we have the build configuration, we can generate the yargs parser options based upon it in
the aptly named `generateYargsCommandsAndOptions`.

Once we the options, we call to yargs to parse them, and then execute the command itself
in `command-build.js`.

### `src/command-build.js`

This is where the bulk of the build logic resides, and probably where most of the features
will be implemented. The main entry point is the function `buildCommand`, which accepts
the configuration and the yarg options after parsing.

It first `extractPackageInfos` by going through the package directories and reading
their `package.json`-s to get their info (name, version, dependencies) using the `npm-packages`
package. Now it knows all the information it needs about _all_ the packags in the monorepo.

But to calculate which packages need to be built or not, it needs the last build time
of all the packages, which it finds using `determineChangedPackagesBuildInformation`, which
it does, mostly through the incredibly complicated code in the `git-packages` package.

Now it has all the information it needs to `calculatePackagesToBuild`, which it does, to get
the `finalPackagesToBuild` to build. Yay, we have our list! We can now execute the build.

#### Executing the build

But first, if it's a dry run, it just needs to show the list of packages to be built, in build
order, which it does in `showPackagesForDryRun`. The way it does that is hacky: it "builds"
the packages using `buildPackages` (this function is also executed when not running under `dryRun`).
`buildPackages` receives a function that determines _what_ to do on each package, and
`showPackagesForDryRun` just sends it a function that adds that package to an array. That way,
at the end of this "build", it has an array with all the packages in build order, which it displays
and returns.

But if we're not "dry running", we need to execte the "before" phase once, the "during" phase
for each package, and the "after" phase once. This is done with the functions ...wait for it...
`executeBeforePhase`, `executeDuringPhase`, and `executeAfterPhase`.

And that's it! Let's just delve into the separate phases, and we're done.

### Executing the "before" phase

This one's easy. If `before` is true (i.e. the user did not add a `--no-before`), then
we use `executePhase` to execute the steps in the before phase.

`executePhase` is a simple function: it uses the function `getPhaseExection`
in the `build-with-configuration` package to get an array of `StepExecution` by which it will
execute each and every step, which it does in a loop.

### Executing the "during" phase

The "during" phase is more complicated, because the steps in that phase need to be executed
per-package, and the package order is determined by the build order. To do that it uses
`buildPackages` (which the "dry running" also used). `buildPackages` knows how to call a function
for each package, in the correct build order. The function it sends, created by `makePackageBuild`,
just calls `executePhase` for the steps in the "during" phase.

`buildPackages` is also inherently simple. It calls `build`, the function from the `build` package.
This `build` function returns an
["async generator"](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)
which calls the build function for each package in the correct order, and yields a value that
indicates whether the build function succeeded or failed.

### Executing the "after" phase

Executing this phase is similar to executing the "before" phase, except that we do it only
if at least one package succeeded.

## Summary

That's it! Pretty simple, given that all the complex functionality is in the other packages. To
summarize:

1. Get the configuration, and determine the Yargs options
1. Execute the yargs parser to get the arguments
1. Pass arguments to `command-build.js` to execute the job
1. Get name/version/dependencies/last-build-time information for all the packages
1. Based on this information, determine which packages to build
1. Execute the "before" phase
1. Execute the "during" phase for all the packages to build, ordered by their dependency graph
1. Execute the "after" phase
