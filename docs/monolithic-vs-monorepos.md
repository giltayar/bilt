# Monolithic codebases vs monorepos

In which it is explained what monolithic codebases are, what monorepos are, and how
monorepos solve the problems monolithic codebases have.

## Monolitic codebases and their problems

A monolithic codebase is a codebase in which modularization is done via source code.
So, for example, if one module wants to import another module,
it will just `require('../another-module')` and thus directly import it from its source code.
Modularization exists in monolithic codebases,
but it is implicit in the folder structure of the codebase, and not so much in explicit
mechanisms like NPM packages. So if we want to "package" multiple files into one "package",
we just create a directory for them. But nothing stops other files from importing any file
in that package, and peeking at its internals.

There are many problems with monolithic codebases:

* Monolithic codebases tend to have tightly-coupled code. Because it is so easy to
  call code from one module to another, people do that, thus generating a sphaghetti set
  of relations between all modules in the codebase. This is the main problem of
  monolithic codebases, and is the main reason for the other problems listed below.
* Monolithic code is hard to reason about, given that every module links to every other module.
  We either understand all the code, or none of it.
* If the code is built (for example, if it's in TypeScript), building it takes a long time, and
  as the codebase grows, so does the build time.
* Tests take a long time to run. Because it is hard to reason about which tests
  need to run and which can be skipped, it is common to run them all, when a codebase changes,
  even if only a small subset needs to run because of that change.
* To mitigate these problems,
  some monolithic codebases separate parts of their code into separate packages
  having their own lifecycle: their own git repo, their own CI jobs, and their own publishing
  lifecycle. Unfortunately, managing all those packages is a chore, and handling the dependencies
  between them is difficult. This ensures that the number of such separate packages is usually
  small (delegated to "common componenents"-style packages).

Please take this critique as it should be taken: many monolithic codebases are wonderfully good,
designed in a good way, and are mostly loosely-coupled. But the _structure_ of a monolithic
codebase tends to make this goodness an uphill struggle—we do not get loose-coupling _because_
this is a monolithic codebase, but despite it.

## Monorepos

Monorepos solve the main problem that monolithic code bases have: tightly-coupled code.
How they do that is simple: your git repo holds not one codebase, but many (a couple, tens,
hundreds, even thousands!). Since Bilt is used for NPM monorepos,
each codebase in a monorepo is an NPM package.

So a Bilt monorepo is just one git repo with lots of independent NPM packages, each linked
with one another using the regular NPM mechanism: dependencies. That is all it is.

How does that solve the above problems in monolithic codebases? By _enabling_ a code structure
that allows for separating your codebase into separate NPM packages, your codebase
can now be more easily modularized and loosely-coupled. In other words, monorepos by themselves
don't solve the problem, but by _enabling_ us to easily manage tens and hundreds of NPM packages,
they _encourage_ us to do so and thus modularize our codebase well.

Monorepos encourage us to create a lot of packages by making it easy to create one:
just create a folder in the monorepo, `npm init` it, and if it need to use other packages,
create dependencies on them the regular NPM way: through `dependencies` in the `package.json`.

If we do that, our codebase becomes more readable, more maintainable, and we can
enjoy less friction in our development. Why?

* Packages have a specific way of communicating between them: the "main" module in the package
  exports a set of functions/classes/constants/whatever, and that is the
  only interface to the package. Whatever happens inside the package, is that package's domain.
  Because it is _so_ easy to create a package in a monorepo, it is done often:
  separating out chunks of code that can be loosely-coupled to other code and packaging them
  into a separate package in your monorepo. And the ease in which packages are created in monorepos
  means that packages _are_ be used for that purpose.
* Packages are a good way of hiding information, so a person reading the codebase can understand
  only a subset of those packages (especially if the other packages they're using have
  good documentation 😉).
* Builds are fast, because each package is *independently* packaged, and so if we change just
  one package, we can build only that package (and its dependents).
* Similarly, tests are separated by package, so if we change just one package,
  we need to run the tests only for that package (and its dependents).
  No need to run all the tests in the monorepo.
* Separating code into packages is easy, and there is no hassle in managing all
  of them. (Except for one problem: building and publishing them. But this is the problem
  that Bilt solves: building, testing, and publishing packages in a monorepo.)

Monorepos can also hold more than one project. Typically today, monorepo git repositories
are uni-project (see, for example, [babel](https://babeljs.io/))—they hold multiple packages
of _one_ project only. Due to the limitations of current build tools for monorepos, a
monorepo cannot be scaled to more than tens of packages. But a monorepo can (and should)
hold all the code of multiple projects of a company, thus allowing them to share some of the
packages between them. This multi-project monorepo approach was made popular by
companies such as Google and Facebook. And Bilt was built specifically to handle multi-project
monorepos.

## Building and publishing packages in monorepos

In monolith codebases, building, running the tests, and publishing, is easy:
we build the whole codebase, run all the tests, and then publish the generated artifacts
(static directory, docker image, or npm package).
Very slow to run, because we need to build and test _everything_, but _very_ easy to manage.

In monorepos, this won't cut it anymore. Yes, we can build all the packages, but first
we need to figure out the _order_ we need to build them. Why?

**Because packages are linked to one another using NPM dependencies**. So if, for example,
package A has a dependency on package B, we need to first build package B,
publish it, and _then_ build package A.

> Note: Why not just use `npm link` to link all the packages
(like [Lerna](https://lerna.js.org/) does)? Because `npm link` is a wonderful
development tool, but is problematic in a number of edge cases, and doesn't work in the large,
for example, when generating Docker images, because Docker doesn't recognize host symlinks.

And if we have many packages (as we should if we're using a monorepo), figuring out the
build order according to the dependencies, and doing it manually, is practically impossible.

But even if we had that build order, then building _all_ the packages anytime just one package
is built negates a lot of the usefulness of monorepos. We want to build _only_ that package,
and all the packages that depend on it (recursively).

And that is what Bilt does. Deal with building, testing, and publishing whatever _needs_ to be
built, and doing it in the correct order.
