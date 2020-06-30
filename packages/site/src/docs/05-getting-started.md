---
tags: toc
layout: docs-layout
title: Getting started
---

In which we understand how to use Bilt in a typical fashion, for regular use cases.
For more information on every Bilt option, go to the [Reference](../reference) chapter.

## Installing Bilt in your monorepo

First, install Bilt:

```sh
npm install --global @bilt/cli
```

This install the `bilt` CLI, which is used to execute Bilt builds on your monorepo.

Next, ensure the packages you have are independent,
as outlined in the [Monorepo structure](../monorepo-structure) chapter. If you are switching
from [Lerna](https://lerna.js.org), then your monorepo is probably already ready for Bilt.

Next, create a `.biltrc.json` file in the root of the monorepo, with the information below:

```js
{
  // list of all the packages. You can use globs, or you can let bilt auto-discover your
  // packages by just using "*". Don't worry, auto-disover works fast.
  // Directories are relative to the root of the monorepo, and MUST be prefixed by a "./".
  "packages": ["./packages/*"],

  // Define the top-level packages (see the concepts section to understand what those are)
  // Typically, you put here all the microservices, client-side apps, and CLI-s.
  // If you have just one project in the monorepo, you can just replicate whatever you put in
  // "packages".
  // You can either give package folders (starting with "./") or package names, as defined
  // in their package.json
  "upto": ["./packages/some-top-level-package", "some-scope/some-cli-package", /*...*/]
}
```

You can run `bilt` in any directory of the monorepo, and it looks upwards for the `biltrc.json`
to determine what the root of the monorepo is.

If you have multiple projects in your monorepo, just have separate `.biltrc-<project>.json`
and reference them in `bilt` using `bilt --config ,biltrc-<project>.json`.

## Running a build on your monorepo

The first project build is slow, as Bilt finds out that no build
has ever been done by it, and so builds _all_ the packages defined in `packages`
in `.biltrc.json` that lead to the packages defined in `upto`,
which is usually _all_ the packages in the monorepo for your project.

To do this just run:

```sh
bilt -m "some commit message"
```

That's it. `bilt` finds the `.biltrc.json` file, determines what
packages to build using `"packages"` and `"upto"` in the `.biltrc.json`, and runs a build on each
of them.

The build works its way up the dependency graph, starting to build the bottom-level
packages and slowly working its way up to the top-level packages you defined in `upto` in the
`.biltrc.json`. It ignores and not builds any packages that don't lead to your `upto` packages,
which means that in a multi-project monorepo it only builds pacakges that are in your project.

> Note: currently, Bilt builds each package serially. In the future,
> it will be able to build the packages in parallel, using the dependency graph to determine
> what _can_ be built in parallel.

How do packages always use the newer version of each other? By the combination
of incrementing the version of a lower-level package, and `npm update`-ing the dependencies
of an upper-level package that depends on it. This works because the lower-level package
is always built _before_ the upper-level package is.

For each package, after that package is built, `git add .` is executed on the package folder,
to stage all the packages changed in that build.

After all the packages have been built, Bilt commits all the staged
files, and `git push`-s them to the remote repository.

The first build is done.

If you run `bilt` again, it finishes _immediately_, and write "Nothing to build", because
it understood that all the packages that need to be built were already built (to understand
how, see
[How Bilt knows which packages were already built](../how-bilt-works#packages-built-how)) for
more information on this.

## Changing code and running the build again

Let's continue with another use case. You've changed two packages in your monorepo,
`npm link`-ing them to see that both work together. What happens when `bilt -m ...` is run again?

Bilt:

1. Analyzes the dependency graph
1. Determines that the two packages were changed
   (see [this section](../how-bilt-works#packages-built-how)) to understand how it does this.
1. Builds the two packages (in the correct order), including all the packages
   dependent on these two packages (in the correct order), upto the packages in your `upto`.

What if you just want to build those two packages, without all the dependents? Use `--no-upto`:

```sh
bilt package-a package-b --no-upto -m "...."
```

This builds the two packages (in the correct order), and only those two packages. Another build,
this time without `--no-upto` will notice that `package-a` and `package-b` were built and so
build up from those packages.

If you want to build only one of the `upto`-s (for example, you changed a lower-level package
used by all microservices, but want to build upto only one microservice), you can use
`--upto`, which will override the `upto` you defined in `.biltrc.json`:

```sh
bilt package-a package-b --upto microservice-a -m "...."
```

Instead of specifying package names, you can specify the package directory. So if you're
currently in the `package-a` directory, you can do this:

```sh
bilt . ../<package-b-folder> -m "..."
```

(or any combination of folders and package names you want)

## Dealing with build failures

What happens if during the building of the packages in the dependency graph, one of the builds
fail?

The build of the dependency graph does _not_ stop. It continues building all the packages
that do not depend on the failed package, but does not build the packages that _do_ depend
on it.

If the bug that caused the build to fail is fixed, and `bilt` is run, then only that package,
and the packages it depends on are now built,
giving the feeling that Bilt "continues" the previous build.
