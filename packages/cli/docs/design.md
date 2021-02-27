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

