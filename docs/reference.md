<!-- markdownlint-disable MD033 -->
# Reference

In which each part of Bilt is broken down to its components and explained thoroughly.

## `biltrc.json`

A file that the `bilt` CLI looks for to:

1. Determine where the root of the monorepo is (where the file resides)
1. To determine what packages are in the project.
1. To determine default values for the CLI command line arguments.

If you do not specify a configuration file, the `bilt` CLI will look in the current
directory and upwards for this configuration, using the usual standards for JS configuration
files (using the [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig)) package, which
searchs for: `.biltrc`, `.biltrc.json`, `.biltrc.yaml`, `biltrc.config.js`
(for the precise algorithm, see the documenation
for [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig)).

### Built-in fields

* `packages`: an array that includes a set of directories. All directories MUST
   start with `.` or `/` and are relative to the configuration file.
   Globs are supported (using [`globby`](https://github.com/sindresorhus/globby)),
   so you can specify `["packages/*"]` if you wish.

   Specifying ["*"] means that Bilt will auto-find the packages itself by crawling all the
   monorepo and looking for directories with a `package.json`. Note that when autofinding
   a package, it will not look inside that package for another package, so nested packages
   are not supported with autofind (although they are supported by specifying packages explicitly)

### Command line argument defaults

All command line arguments can be given defaults in this file. So if, for example,
you do not want to run `npm audit fix`, include `"audit": false` in your `.biltrc.json`.

## `bilt` CLI

### Usage

```sh
bilt [packagesToBuild..] [...options]
```

### What it does

1. Bilt first finds the `.biltrc.json` as explained above.
1. It reads the file and determines the full set of packages it needs to build. The build
   will always include just a subset of those packages
1. It determines which packages to build from that list using the `packagesToBuild` in the CLI.
   those are the "base" packages to build. If there are no `upto` packages, then those are the
   only packages that it will build.
1. It determines the `upto` packages, i.e. which packages are the top level packages in the
   dependency graph. If one of the `packagesToBuild` dependency chain does not lead to any
   of the `upto` packages, then it will not be built. Conversely, if one the `packagesToBuild`
   leads in its chain to a package other than one of the `upto` packages, that chain will not be
   built. Only chains that lead to `upto` packages will be built.
1. Once it has the full set of packages to build, it will build the dependency graph,
   and from there determine the build order
   (using [topological sorting](https://en.wikipedia.org/wiki/Topological_sorting)).
1. Now it starts building:
1. `bilt` builds each package according to the build configuration
   (see below for the default configuration). The build configuration also includes
   steps that are done _before_ all the package builds
   start (usually pulling from the remote repository), and steps that are done _after_ all
   the packages are built (usually commiting the changes and pushing to the remote repository).
1. As described above, when commiting a commit, it will add the text `[bilt-artifacts]` to
   the commit message in order to understand that this commit is a formal build of those packages.
1. If a package build fails, the build itself will continue, but only with packages that
   do not depend on that package (recursively). This is a partial build, but note that the
   post package-build steps still happen, and so the packages that are built will be published,
   commmited, and pushed.

### Options

Most options below have shortcut aliases, which you can find using `--help`.

* `--config`: the config file to read. Optional, and if does not exist, will search
  for it, as described above.
* `packagesToBuild`: a set of package directories or package names. If a directory, it MUST
  start with a `.` or `/` to differentiate from package names. Usually, packages here are
  a subset of packages from the packages determined by the config files `packages` field,
  but theoretically, you can add to them. If the package is a package _name_, then they must
  come from the from the packages determined by the config files `packages` field.
* `--upto`: a set of package directories or package names. These are also added to the
  `packagesToBuild` so you don't need to specify them in both places. If a directory, it MUST
  start with a `.` or `/` to differentiate from package names. Usually, packages here are
  a subset of packages from the packages determined by the config files `packages` field,
  but theoretically, you can add to them. If the package is a package _name_, then they must
  come from the from the packages determined by the config files `packages` field.

  The `upto` packages determine what the dependency graph is, as explained in the
  [What it does](#what-it-does) section.

* `--dry-run`: don't run the build, just show what packages _would_ be built, and in what order.
* `--message`: the commit message when committing
  (note that `bilt` will add a small `[bilt-artifacts]` tag to it, as described above).
* `--force`: force the `packagesToBuild` packages (and their dependencies) to be built,
  even if they haven't changed.
* `--assume-changed`: force the packages dependent on the `packagesToBuild` package to be built,
  even if `packagesToBuild` or their dependents haven't changed. (Not yet implemented!)
* `--version`: show the version number of `bilt`.
* `--help`: show the help.

#### Build Option

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

1. `npm install` to ensure all dependencies are installed
1. `npm update` to update all the dependencies.
    This is especially important in Bilt, as it updates
    the dependencies of the other packages in the monorepo. Without `npm update`, you will
    be depending on an older version of your packages.
1. _Increment_ version: the patch level version of the package will be updated to the next
   available patch level for the current `major.minor` version defined in the `package.json`.
   See [this](./how-bilt-works.md#version-increment-how) for more information.
1. `npm audit fix`. Because we're security conscious.
1. `npm run build`: build the source code, for example transpile the code, bundle it,
   or build a docker image. This will be run only if a `build` script exists in the `package.json`.
1. `npm test`: because we have test, right? 😉 Will skip if no `test` script exists
1. `npm publish`: publishes the package

After this, it will also run `git add .` to add all the files to be commited.

After all of the package builds:

1. `git commit -m "commit message"`: commit all the added files.
2. `git push`: pushes changes to the remote repository.

## <a name="configuring-build">Configuring the build

Not yet implemented!
