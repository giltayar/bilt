<!-- markdownlint-disable MD033 -->

# Bilt

A build tool for NPM monorepos

## What is Bilt

Bilt is a CLI that builds, tests, and publishes NPM packages
in your monorepos, and does that in the proper order, according to the packages dependency graph,
while guaranteeing that only those packages that were not built (and their dependents) get built.

It's a ["make"](<https://en.wikipedia.org/wiki/Make_(software)>) for NPM monorepos.

## Why Bilt

(To go directly to the meat of Bilt, read
[Structure of a Bilt monorepo](./docs/monorepo-structure.md) and then
go to the [Getting started](./docs/getting-started.md) chapter.)

Monorepos are a wonderful concept! They enable us to structure our code as a large set of
loosely-coupled packages, instead of one big monolithic codebase, which is usually
tightly-coupled.

But the current build tools we have for monorepos are lacking. They are either difficult
to work with (Bazel), not powerful enough for big monorepos (Lerna), or can work only with
specific codebases (Nx). For more, see the [Alternatives](./docs/alternatives.md) section.

Bilt is designed for small and large repos, and is simple to use, assuming your
monorepo is built as a series of NPM packages linked together by an NPM dependency graph.

## Table of Contents

1. [Monolithic codebases vs monorepos](./docs/monolithic-vs-monorepos.md)
1. [Alternatives to Bilt](./docs/alternatives.md)
1. [Bilt concepts](./docs/concepts.md)
1. [Structure of a Bilt monorepo](./docs/monorepo-structure.md)
1. [Getting started](./docs/getting-started.md)
1. [How Bilt works](./docs/how-bilt-works.md)
1. [Reference](./docs/reference.md)
1. [Build configurations](./docs/build-configurations.md)

## Contributing

If you want to help contribute, to built, go [here](./contributing.md) to learn ahout the Bilt code, how to build it, and how to contribute.
