<!-- markdownlint-disable MD033 -->
# Reference

In which each part of Bilt is broken down to its components and explained thoroughly.

## <a name="configuration-file"></name>`.biltrc.json` Configuration file

The configuration file that the `bilt` looks for to:

1. Determine where the root of the monorepo is (the same directory the `.biltrc.json` resides in)
1. Determine what packages are in the project
1. Determine default values for the `bilt`command line arguments.

If you do not specify a configuration file, `bilt` CLI looks in the current
directory and upwards for the configuration file, using the usual standards for JS configuration
files (using the [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig)) package, which
searchs for: `.biltrc`, `.biltrc.json`, `.biltrc.yaml`, `biltrc.config.js`
(for the precise algorithm, see the documenation
for [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig)).

### Fields

* `packages`: an array that includes a set of directories. All directories MUST
   start with `.` or `/` and are relative to the configuration file.
   Globs are supported (using [`globby`](https://github.com/sindresorhus/globby)),
   so you can specify `["packages/*"]` if you wish.

   Specifying ["*"] tells Bilt to auto-discover the packages by crawling the
   monorepo directories and looking for directories with a `package.json`.
   When auto-discovering a package,
   it does not look inside that package for another package, so nested packages
   are not supported in auto-discovery
   (although they are supported by specifying packages explicitly).

### Command line argument defaults

All command line arguments can be given defaults in this file. So if, for example,
you do not want to run `npm audit fix`, include `"audit": false` in your `.biltrc.json`.

If the command line argument has dashes in it (e.g. `dry-run`), convert it to camel case
(e.g. `dryRun`) to use it for defaults in the `.biltrc.json`.

The most common command line argument to override is `upto`, as usually you do not want to
specify all the top-level packages in each run of the `bilt` CLI.

## `bilt` CLI

### Usage

```sh
bilt [packagesToBuild...] [options...]
```

### What it does

1. Bilt first finds the `.biltrc.json` configuration file as explained above.
1. It reads the configuration file to determine the full set of packages that can be built.
   The build always builds just a subset of those packages.
1. It determines which packages to build from that list using the `packagesToBuild` command line
   argument. those are the "base" packages to build.
   If there are no `upto` packages, then those are the only packages that it will build.
1. It determines the `upto` packages, i.e. which packages are the top level packages in the
   dependency graph. If none of the `packagesToBuild` dependency chains lead to one
   of the `upto` packages, then that `upto` package is ignored.
   Conversely, if one the `packagesToBuild`
   leads in its chain to a package other than one of the `upto` packages, then that
   `packageToBuild` chain is not built. Only chains that lead to the `upto` packages will be built.
1. Once it has the full set of packages to build, it calculates the dependency graph,
   and from there determine the build order of the packages
   (using [topological sorting](https://en.wikipedia.org/wiki/Topological_sorting)).
1. `bilt` builds each package according to the build configuration
   (see below for the default configuration). The build configuration also includes
   steps that are done _before_ all the package build
   (usually pulling from the remote repository), and steps that are done _after_ all
   the packages are built (usually commiting the changes and pushing to the remote repository).
1. As described [elsewhere](./how-bilt-works.md#packages-built-how),
   when commiting a commit, Bilt adds the text `[bilt-artifacts]` to
   the commit message in order to remember that this commit is a formal build of those packages.
1. If a package build fails, the build itself will continue, but only for packages that
   do not depend on that package (recursively). This is a partial build, but note that the
   post package-build steps still happen, and so the packages that are built are published,
   commmited, and pushed.

### Options

Most options below have shortcut aliases, which you can find using `--help`.

* `--config`: the config file to read. Optional, and if does not exist, will search
  for it, as described [above](#configuration-file).
* `packagesToBuild`: a set of package directories or package names. If a directory, it MUST
  start with a `.` or `/` to differentiate from package names. Usually, packages here are
  a subset of packages of the packages determined by the config file's `packages` field,
  but theoretically, you can add to them. If the package is a package _name_, then they must
  come from the from the packages determined by the config file's `packages` field.
* <a name="upto"></a>`--upto`: a set of package directories or package names.
  These are also added to the
  `packagesToBuild` so you don't need to specify them in both places. If a directory, it MUST
  start with a `.` or `/` to differentiate from package names. Usually, packages here are
  a subset of packages from the packages determined by the config file's `packages` field,
  but theoretically, you can add to them. If the package is a package _name_, then they must
  come from the from the packages determined by the config file's `packages` field.
* `--dry-run`: don't run the build, just show what packages _would_ be built, and in what order.
* `--message`: the commit message when committing
  (note that `bilt` will add a small `[bilt-artifacts]` text to it, as described above).
* `--force`: force the `packagesToBuild` packages (and their dependencies) to be built,
  even if they haven't changed.
* <a name="assume-changed"></a>`--assume-changed`:
  force the packages dependent on the `packagesToBuild` package to be built,
  even if `packagesToBuild` or their dependents haven't changed. (Not yet implemented!)
* `--version`: show the version number of `bilt`.
* `--help`: show the help that summarizes all these options.

#### Build Option

All of these build options have a default of `true`.

* `--pull`: enables disables "pull" when building
* `--push`: enables disables "push" when building
* `--commit`: enables disables "commit" when building
* `--install`: enables disables "install" when building
* `--update`: enables disables "update" when building
* `--audit`: enables disables "audit" when building
* `--build`: enables disables "build" when building
* `--test`: enables disables "test" when building
* `--publish`: enables disables "publish" when building
* `--git`: no-git disables push/pull/commit together

## Default build steps

Before all of the package builds:

1. `git pull --rebase --autostash`: to pull all changes from the remote repository before building.

For each package:

1. `npm install` ensures all dependencies are installed
1. `npm update` updates all the dependencies.
    This is especially important in Bilt moonorepos, as it updates
    the dependencies to the other packages in the monorepo. Without `npm update`, packages
    will have outdated dependencies on the other packages in a monorepo.
1. _Increment_ version: to update the version of the package so it can be published.
   See [this](./how-bilt-works.md#version-increment-how) for more information.
1. `npm audit fix`. Because we're security conscious!
   (See [Snyk](https://snyk.io) for a more powerful alternative.)
1. `npm run build`: build the source code. For example transpile the code, bundle it,
   or build a docker image. This runs only if a `build` script exists in the `package.json`.
1. `npm test`: because we have tests, right? 😉 Will skip if no `test` script exists
1. `npm publish`: publishes the package

After this, Bilt also runs `git add .` to add all the files to be commited.

After all of the package builds:

1. `git commit -m "commit message"`: commit all the added files (with the addition of the
   `[bilt artifacts]` text to the commit message, as described above).
2. `git push`: pushes changes to the remote repository.

## <a name="configuring-build">Configuring the build

Not yet implemented!
