<!-- markdownlint-disable MD033 -->
# Bilt

A build tool for NPM monorepos

(if you want to skip the intro, you can go directly to [usage](#usage))

## Why Bilt

(if you want to skip the motivation for Bilt
and just want to understand how to use it, go to the [Usage](#usage)) section.

Monorepos are a wonderful concept! They enable us to structure our code as a large set of
loosely-coupled packages, instead of one big monolithic codebase, which is usually very
tightly coupled.

### Monolitic codebases

There are many problems with monolithic codebases:

* Monolithic codebases tend to have very tightly-coupled code. Because it is so easy to
  call code from one module to another, people do that, thus generating a sphaghetti set
  of relations between all modules in the codebase. This is the main problem of
  monolithic codebases, and is the main reason for the other problems listed below.
* Monolithic code is hard to reason about, given that every module links to every other modules.
  You either understand all the code, or none of it.
* If you need to build your code (say you use TypeScript), building it takes a long time, and
  as the codebase grows, so does your build time.
* Tests take a long time to run. It is very hard to reason about which tests to run and which
  can be skipped, so usually the solution is to run them all, even if only a small subset
  needs to run.
* To mitigate that, some monolithic codebases separate parts of their code into separate packages,
  having their own lifecycle: their own git repo, their own CI jobs, and their own publishing
  lifecycle. Unfortunately, managing all those packages is a chore, and handling the dependencies
  between them is difficult. This ensures that the number of such separate packages is usually
  very small (delegated to "common componenents"-style packages).

### Monorepo codebases

Monorepos solve the main problem that monolithic code bases have: tightly-coupled code.
How they do that is simple: your git repo holds not one codebase, but many (a couple, tens,
hundreds, even thousands!). Since Bilt is used for NPM monorepos,
each codebase in the monorepo is an NPM package.

So a Bilt monorepo is just one git repo with lots of
independent NPM packages. That is all.

How does that solve the above problems in monolithic codebases? They actually don't! It's up to
you! But they _enable_ a code structure that allows you to solve that problem. And that
code structure is a set of independent and loosely-coupled packages.

Monorepos encourage us to create a lot of packages by making it very easy to create one:
just create a folder in the monorepo, `npm init` it, and if you need to use other package,
create dependencies on them the regular NPM way: through `dependencies` in the `package.json`.

If you do that, your codebase will become more readable, more maintainable, and you will
enjoy less friction in your development. Why?

* Packages have a very specific way of communicating between them: the "main" module in the package
  exports a set of functions/classes/constants/whatever, and that is all. Whatever happens inside
  the package, is that package's domain. Because it is _so_ easy to create a package in a monorepo,
  you should be doing it often: separating out chunks of code that can be loosely-coupled to other
  code and packaging them into a separate package in your monorepo.
  And the ease in which packages are created in monorepos means
  that packages _will_ be used for that purpose.
* Packages are a good way of hiding information, so a person reading the codebase can understand
  only a subset of those packages (especially if the other packages they're using have
  good documentation 😉).
* Builds are very fast, because each package is independently packaged, and so if you change just
  one package, you need to only build that package (and its dependents). No need to build others.
* Similarly, tests are separated by package (even if you have a big "end to end" test, it can
  reside in its own package), so if you change just one package, you need to run the tests
  only for that package (and its dependents). No need to run all the tests in the monorepo.
* Separating code into packages is very easy, and there is no hassle in managing all
  of them, except for one problem: building and publishing them.
  This is why Bilt exists.

Monorepos can also hold more than one project. Typically, today, monorepo git repositories
are uni-project (see, for example, [babel](https://babeljs.io/))—they hold multiple packages
of _one_ project only. But for Bilt's purpose, a monorepo can (and should)
hold all the code of multiple projects of a company, thus allowing them to share some of the
packages between them. This approach was made popular by companies such as Google and Facebook.

### Building and publishing packages in monorepos

In monoliths, building, running the tests, and publishing it, is easy: you build it all, then
run all the tests, and then publish the generated artifact (static directory, docker image,
oir npm package) in one command. Very slow, because you need to build and test _everything_,
but _very_ easy.

In monorepos, this won't cut it anymore. Yes, you can build all the packages, but first
you need to figure out the _order_ you need to build them. Why?

Because packages are linked to one another using NPM dependencies. So if package A has a dependency
on package B, we need to first build package B, publish it, and _then_ build package A.

> Note: Why not just use `npm link` to link all the packages? Because `npm link` is a wonderful
> development tool, but is problematic in a number of edge cases, and doesn't work in the large,
> for example, when generating Docker images, because Docker doesn't recognize host symlinks.

And if you have many packages (as you should if you're using a monorepo), figuring out the
build order according to the dependencies, and doing it manually, is practically impossible.

But even if you had that build order, then building _all_ the packages anytime just one package
is built negates a lot of the usefulness of monorepos. We want to build _only_ that package,
and all the packages that depend on it (recursively).

### What is Bilt

Bilt is a CLI that you use to build, test, and publish the packages
in your monorepos, and knows how to do that in the correct dependency, guaranteeing that only
those packages that were not built (and their dependents) get built, and get built in the correct
order.

You can run Bilt locally on your computer, or run it in your CI.

### Alternative solutions

Why does Bilt exist? Aren't there any other solutions out there? It
seems that there are, given that monorepos have gained in popularity in the last several years.

> Note: I have tried these tools a bit, but not extensively, so I may be totally off on their
> capabilities. I'd love if somebody that used these tools can correct me.

#### Lerna

[Lerna](https://github.com/lerna/lerna): the most popular monorepo tool out their. It leans
on "Yarn workspaces" to enable the different packages to share dependencies
between them, and thus makes `npm link`-ing them together easier in more cases (although
not all of them!). On that, it gives a series of command that you can execute on
_all_ the packages in your monorepo.

So in Lerna, you can do stuff like running a build, or publishing the packages in a nice way,
but it isn't really interested in the dependency graph between the packages.

Lerna is great for a small set of packages that are deeply connected with one another (think
all packages in the [babel](https://babeljs.io/) project), but only if you are OK with building
and testing _all_ packages at once.

Bilt was built (aaah!) to treat each package as a totally independent
entity, while understanding the relationships between the packaedeges. This enables
Bilt to scale to hundreds of packages in repo, spanning
multiple projects.

#### Nx

According to the Nx [website](https://nx.dev), "Nx [...] analyzes your workspace
and figures out what can be affected by every code change.
That's why Nx doesn't rebuild and retest everything on every commit--
it only rebuilds what is necessary. Nx also uses a distributed computation cache.
If someone has already built or tested similar code,
Nx will use their results to speed up the command for everyone else instead
of rebuilding or retesting the code from scratch.
This, in combination with Nx’s support for distributed and incremental builds,
can help teams see up to 10x reduction in build and test times."

While this sounds perfect, the cost of this is that Nx deeply understands your codebase. So it
needs to understand whether your codebase is Angular, React, Vue, Node, or whatever, as it has
plugins for each and every one of them.

Bilt doesn't care what is in your package, as long as you defined
a build step for each and every one of them.

#### Bazel

[Bazel](https://bazel.build/), from Google, is supposed to be similar to the internal tool
Google have for building their monorepo. It is a veritable workhorse, and super powerful tool
for dealing with repos of thousands (and probably tens of thousands) of packages, spanning
multiple packages.

But configuring your project to use Bazel is a complicated thing. Seriously, I couldn't make
heads or tails on how to do it. The reason for this is it's multi-language approach, and its
extreme flexibility, which comes at the cost of configuration and understanding.

Bilt gives similar capabilities, but relies on NPM's `package.json` and
appraoch to publishing NPM packages, to give it the capabilities it has to handle repos
of hundreds of packages.

## Concepts

* Project
* Package
* Build
* Dependency graph
* Top-level packages and bottom-level packages

## <a name="bilt-style-monorepo"></a>How to build a monorepo, Bilt-style

A monorepo in Bilt is structured in a simple manner:

1. Have NPM packages in any folder structure you want. I've found that putting all
   packages in a `packages` folder, in a flat way, is a good way to structure it, but you can
   go all hierarchical if you want—bilt doesn't care.
1. Each package should be a regular NPM package, with it's own `package.json`, including
   `name`, `version`, and usually a set of `scripts` like `build` and `test` that are used
   to build and test the package before publishing.
1. Each package should be publishable to an NPM registry. This is important because other
   packages consume other packages through the regular mechanism of NPM dependencies.
1. If a package needs to generate other artifacts in other registries (such as a docker image
   for microservice packages), use `postpublish`, and we recommend to publish it with the
   same version number as the package's.
1. The _only_ mechanism for code sharing should be through NPM dependencies. Packages should
   never directly consume another package's source code (e.g. by importing it directly).

Each package needs to be able to be built separately. While you can configure
different build steps if you want (see [Configuring the build](#configuring-build)),
the default build steps work pretty nicely for most projects:

1. `npm install` to ensure all dependencies are installed
1. `npm update` to update all the dependencies.
    This is especially important in Bilt, as it updates
    the dependencies of the other packages in the monorepo. Without `npm update`, you will
    be depending on an older version of your packages.
1. _Increment_ version: the patch level version of the package will be updated to the next
   available patch level for the current `major.minor` version defined in the `package.json`.
   See [this](#version-increment-how) for more information.
1. `npm audit fix`. Because we're security conscious.
1. `npm run build`: build the source code, for example transpile the code, bundle it,
   or build a docker image. This will be run only if a `build` script exists in the `package.json`.
1. `npm test`: because we have test, right? 😉 Will skip if no `test` script exists
1. `npm publish`: publishes the package

So configure your packages so the above build will work. A typical `package.json` that works
well will be something like this:

```js
{
  "name": "@some-scope/a-microservice-in-typescript",
  "version": "1.0.10",
  // ...
  "scripts": {
     // building the code
    "build": "tsc",
     // ensuring the docker image also gets built when building the code
    "postbuild": "'npm run build:docker",

    // testing whatever needs to be tested
    "test": "npm run test:eslint && npm run test:mocha",

    // publish the docker image when publishing the package
    "postpublish": "npm run publish:docker",


    // sub-scripts used by the above main scripts
    "test:mocha": "mocha ...",
    "test:eslint": "eslint 'test/**/*.?s' 'test/**/*.?s'",
    // building a docker image with the same version as the package
    "build:docker": "docker build -t some-scope/a-microservice:${npm_package_version}",
    // ensuring it gets published to the docker registry along with the package
    "publish:docker": "docker push some-scope/a-microservice:${npm_package_version}"
  },
  "dependencies": {
    "some-scope/another-package-used-by-this-one": "^2.4.3",
    //...
  },
  "devDependencies": {
    "some-scope/a-build-tool-used-by-this-one": "^1.7.2s",
    // ...
  }
}
```

## Usage

This section outlines how to use Bilt in a typical usage fashion.
If you want more precise information on every Bilt option, go to the
[reference](#reference) section.

## Installing Bilt in your monorepo

The simplest way to use Bilt is this way:

First, install Bilt:

```sh
npm install --global @bilt/cli
```

This will install the `bilt` CLI.

Now ensure the packages you have are independent,
as outlined in the [above-section](#bilt-style-monorepo). If you are switching
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

### Changing code and running the build again

Let's continue with another use case. You've changed two packages in your monorepo,
`npm link`-ing them to see that both work together. What happens when you run `bilt -m ...` again?

Bilt will:

1. Analyze the dependency graph
1. Determine that the two packages were changed (see [this section](#packages-built-how)) to
   understand how it does this.
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
> to force it to do so, use [`--assume-changed`](#upto) to force bilt to build all the packages
> that depend on the two packages.

### Dealing with build failures

What happens if during the building of the packages in the dependency graph, one of the builds
fail?

The build of the dependency graph does _not_ stop. It will continue building all the packages
that do _not_ depend on the failed package, but will not build the packages that _do_ depend
on it.

If you now fix the bug in the build that failed, only that package, and the packages it depends
on will now be built, which gives the feeling that Bilt "continues"
the previous build.

## Reference

### `biltrc.json`

### `bilt` CLI

### Default build steps

### <a name="configuring-build">Configuring the build

## How Bilt works

### How Bilt determines the dependency graph

### <a name="version-increment-how"></a>How Bilt increments the package version

### <a name="packages-built-how"></a>How Bilt knows which packages were already built
