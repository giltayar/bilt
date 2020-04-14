# Monolithic codebases vs monorepos

In which it is explained what monolithic codebases are, what monorepos are, and how
monorepos solve the problems monolithic codebases have.

## Monolitic codebases and their problems

A monolithic codebase is a codebase where modularization is done via source code. So, for example,
if one module wants to import another module, it will use `require('../another-module`)` and
directly import it from its source code. Modularization exists in monolithic codebases,
but it is implicit in the folder structure of the codebase, and not so much in explicit
mechanisms like NPM packages.

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

## Monorepos

Monorepos solve the main problem that monolithic code bases have: tightly-coupled code.
How they do that is simple: your git repo holds not one codebase, but many (a couple, tens,
hundreds, even thousands!). Since Bilt is used for NPM monorepos,
each codebase in the monorepo is an NPM package.

So a Bilt monorepo is just one git repo with lots of independent NPM packages, each linked
with one another using the regular NPM mechanism: dependencies. That is all it is.

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

## Building and publishing packages in monorepos

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
