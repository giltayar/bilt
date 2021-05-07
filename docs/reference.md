<!-- markdownlint-disable MD033 -->
# Reference

In which each part of Bilt is broken down to its components and explained thoroughly.

## <a name="configuration-file"></name>`.biltrc.json` Configuration file

The configuration file that the `bilt` looks for to:

1. Determine where the root of the monorepo is (the same directory the `.biltrc.json` resides in)
1. Determine what packages are in the project
1. Determine default values for the `bilt`command line arguments.
1. Determine the build configuration for the project.

If you do not specify a configuration file, `bilt` CLI looks in the current
directory and upwards for the configuration file, using the usual standards for JS configuration
files (using the [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig)) package, which
searchs for: `.biltrc`, `.biltrc.json`, `.biltrc.yaml`, `biltrc.config.js`
(for the precise algorithm, see the documenation
for [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig)).

### Properties

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
* `jobs`: either the JSON of a build configuration (that builds the `packages`), or a string
  containing the path to the build configuration (which will be loaded using
  [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig)). If empty, will default to [the
  default build configuration built into
  Bilt](./build-configurations.md#the-default-build-configuration).
* `jobDefaults`: an object whose keys are `jobIds` (see [build
   configuration](./build-configurations.md)), and values are objects that define
   the default command line arguments for that job.
* Other fields: any other field here is a default for the command line arguments that
  are common to all the build configurations (see [this section](#command-line-argument-defaults))
  for more information.

### Command line argument defaults

All command line arguments can be given defaults in this file. If they are specific
to a build configuration, they will be under the `jobs` property, as specified above,
otherwise they will be at the top-level, as defined in "Other fields" above.

If the command line argument has dashes in it (e.g. `dry-run`), convert it to camel case
(e.g. `dryRun`) to use it for defaults in the `.biltrc.json`.

The most common command line argument to override is `upto`, as usually you do not want to
specify all the top-level packages in each run of the `bilt` CLI.

## `bilt` CLI

### Usage

```sh
bilt [job] [packagesToBuild...] [options...]
```

### What it does

1. Bilt first finds the `.biltrc.json` configuration file as explained above.
1. The configuration file's `buildConfiguration` field determines what the [build
   configuration](./build-configurations.md) is. The build configuration determines
   what jobs are available, and what the build options are for those jobs.
1. If `job` is not specified in the command line, `build` is used.
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
1. `bilt` builds each package according to the [build
   configuration](./docs/build-configurations.md). The build configuration also includes steps that
   are executed _before_ all the package build (usually pulling from the remote repository), and
   steps that are executed _after_ all the packages are built (usually commiting the changes and
   pushing to the remote repository).
1. As described [elsewhere](./how-bilt-works.md#packages-built-how),
   when commiting a commit, Bilt adds the text `[bilt-with-bilt]` to
   the commit message in order to remember that this commit is a formal build of those packages.
1. If a package build fails, the build itself will continue, but only for packages that
   do not depend on that package (recursively). This is a partial build, but note that the
   post package-build steps still happen, and so the packages that are built are published,
   commmited, and pushed.

### Options

Most options below have shortcut aliases, which you can find using `--help`. These options
are relevant for _all_ build job configurations.

* `job`: the job to execute from the build configuration. If not specified, the job will be `build`.
* `--config`: the config file to read. Optional, and if does not exist, will search
  for it, as described [above](#configuration-file).
* `packagesToBuild`: a set of package directories or shortcuts or the entire package names. If a directory, it MUST
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
  (note that `bilt` will add a `[bilt-with-bilt]` text to it, as described above).
* `--force`: force the `packagesToBuild` packages (and their dependencies) to be built,
  even if they haven't changed.
* `--before`, `--after`: whether to execute the `before` and `after` steps. The default is `true`.
* `--envelope`: the aggregate option that aggregates `--before` and `--after`.
* `--version`: show the version number of `bilt`.
* `--help`: show the help that summarizes all these options.

#### Build Option

Each build configuration comes with its own build options.  All of these build options have a
default of `true`, and are the options specified in the build configuration, as defined above.

### <a name="configuring-build">Configuring the build

See [here](./build-configurations.md).

### Default build steps

You can find the build configuration for the default build configuration
[here](./packages/build-with-configuration/src/types.js). For a human discussion
of this build configuration, look [here](./build-configurations#the-default-build-configuration).
