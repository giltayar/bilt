# Usage

This section outlines how to use Bilt in a typical usage fashion.
If you want more precise information on every Bilt option, go to the
[reference](./reference) chapter.

## Installing Bilt in your monorepo

The simplest way to use Bilt is this way:

First, install Bilt:

```sh
npm install --global @bilt/cli
```

This will install the `bilt` CLI.

Now ensure the packages you have are independent,
as outlined in the [Monorepo structure](./monorepo-structure.md) chapter. If you are switching
from Lerna, then your monorepo is probably already ready for Bilt.

Then create a `.biltrc.json` file in the root of the monorepo, with the information below:

```js
{
  // list of packages. You can use globs, or you can even let bilt auto-discover your
  // packages by just using "*". Don't worry, it works incredibly fast.
  "packages": ["./packages/*"],

  // Define your top-level packages (see the concepts section to understand what those are)
  // Typically, you put here all the microservices, client-side apps, and CLI-s.
  // You could also replicate whatever you put in "packages", if you want.
  // You can either give package folders (starting with "./") or package names, as defined
  // in their package.json
  "upto": ["./packages/some-top-level-package", "some-scope/some-cli-package", /*...*/]
}
```

You can run `bilt` in any folder of the monorepo, and it will look upwards for the `biltrc.json`
to determine what the root of the monorepo is.

If you have multiple projects in your monorepo, just have separate `.biltrc-<project>.json`
and reference them in Bilt using `bilt --config ,biltrc-<project>.json`.

You're done!

## Running a build on your monorepo

Your first project build will be slow, as Bilt finds out that no build
has ever been done by it, and so will build _all_ the packages that are in the dependency
graph that leads to the packages you defined in `upto`, which is usually _all_ the packages in
the monorepo for your project.

To do this just run:

```sh
bilt -m "commit message"
```

That's it. It will find the `.biltrc.json` file, determine what
packages to run using `"packages"` and `"upto"` in the `.biltrc.json`, and run a build on each
of them.

The build will work its way up the dependency graph, starting to build the bottom-level
packages and slowly working its way up to the top-level packages you defined in `upto` in the
`.biltrc.json`. It will ignore and not build any packages that don't lead to your `upto` packages,
which means that in a multi-project monorepo it will only build pacakges that are in your project.

> Note: currently, Bilt builds each package serially. In the future,
> It will be able to build the packages in parallel, using the dependency graph to determine
> what _can_ be built in parallel.

How do packages always use the newer version of each other? By the one-two punch combination
of incrementing the version of a lower-level package, and `npm update`-ing the dependencies
of an upper-level package that depends on it. This works because the lower-level package
is always built _before_ the upper-level package is.

For each package, after that package is built, `git add .` is executed on the package folder,
to stage all the packages changed in that build (usually, `package.json` and `package-lock.json`,
but it may also be files that you changed locally).

After all the packages have been built, Bilt commits all the staged
files (note that if you have any files in your monorepo that are in packages that were not built,
they will _not_ be commited, which is a good thing), and `git push`-s them to the remote repository.

Boom! You're done.

If you run `bilt` again, it will finish _immediately_, and write "Nothing to build", because
it understood that all the packages that need to be built were already built.

## Changing code and running the build again

Let's continue with another use case. You've changed two packages in your monorepo,
`npm link`-ing them to see that both work together. What happens when you run `bilt -m ...` again?

Bilt will:

1. Analyze the dependency graph
1. Determine that the two packages were changed
   (see [this section](./how-bilt-works.md#packages-built-how)) to understand how it does this.
1. Build the two packages (in the correct order), and including all the packages
   dependenct on these two packages (in the correct order), upto the packages in your "upto".

What if you just want to build those two packages, without all the dependents? Use `--no-upto`:

```sh
bilt package-a package-b --no-upto -m "...."
```

This will build the two packages (in the correct order), and only those two packages.

If you want to build only one of the `upto`-s (for example, you changed a lower-level package
used by all microservices, but )

Instead of specifying package names, you can specify the folders. So if you're
currently `package-a` folder, you can do this:

```sh
bilt . ../<package-b-folder> -m "..."
```

(or any combination of folders and package names you want)

> Note that if you now run `bilt` again, with no packages, it will _not_ build the dependent
> packages again, since it notes that no packages were changed since their last build. If you want
> to force it to do so, use [`--assume-changed`](./reference.md#upto)
> to force bilt to build all the packages that depend on the two packages.

## Dealing with build failures

What happens if during the building of the packages in the dependency graph, one of the builds
fail?

The build of the dependency graph does _not_ stop. It will continue building all the packages
that do _not_ depend on the failed package, but will not build the packages that _do_ depend
on it.

If you now fix the bug in the build that failed, only that package, and the packages it depends
on will now be built, which gives the feeling that Bilt "continues"
the previous build.
