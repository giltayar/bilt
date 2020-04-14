<!-- markdownlint-disable MD033 -->
# Bilt

A build tool for NPM monorepos

## What is Bilt

Bilt is a CLI that you use to build, test, and publish the packages
in your monorepos, and knows how to do that in the correct dependency, guaranteeing that only
those packages that were not built (and their dependents) get built, and get built in the correct
order.

## Why Bilt

(If you want to go directly to the meat of Bilt, read
[Structure of a Bilt monorepo](./docs/monorepo-structure.md) and then
go to the [Usage](./docs/usage.md)) chapter.)

Monorepos are a wonderful concept! They enable us to structure our code as a large set of
loosely-coupled packages, instead of one big monolithic codebase, which is usually very
tightly coupled.

But the current build tools we have for monorepos are lacking. They are either very difficult
to work with (Bazel), not powerful enough for big monorepos (Lerna), or can work only with
specific codebases (Nx). See the [Alternatives](./docs/alternatives.md) chapter on why.

Bilt is designed for small and large repos, and is very simple to use, assuming your
monorepo is built as a series of NPM packages linked together by an NPM dependency graph.

## Table of Contents

1. [Monolithic codebases vs monorepos](./docs/monolithic-vs-monorepos.md)
1. [Alternatives to Bilt](./docs/alternatives.md)
1. [Bilt concepts](./docs/concepts.md)
1. [Structure of a Bilt monorepo](./docs/monorepo-structure.md)
1. [Usage](./docs/usage.md)
1. [Reference](./docs/reference.md)
1. [How Bilt works](./docs/how-bilt-works.md)
