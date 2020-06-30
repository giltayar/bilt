---
tags: toc
layout: docs-layout
title: Bilt
---
<!-- markdownlint-disable MD033 -->

A build tool for NPM monorepos

## What is Bilt

Bilt is a CLI that builds, tests, and publishes packages
in your monorepos, and does that in the proper order, according to the packages dependency graph,
while guaranteeing that only those packages that were not built (and their dependents) get built.

## Why Bilt

(To go directly to the meat of Bilt, read
[Structure of a Bilt monorepo](./monorepo-structure) and then
go to the [Getting started](./getting-started) chapter.)

Monorepos are a wonderful concept! They enable us to structure our code as a large set of
loosely-coupled packages, instead of one big monolithic codebase, which is usually
tightly-coupled.

But the current build tools we have for monorepos are lacking. They are either difficult
to work with (Bazel), not powerful enough for big monorepos (Lerna), or can work only with
specific codebases (Nx). For more, see the [Alternatives](./alternatives) section.

Bilt is designed for small and large repos, and is simple to use, assuming your
monorepo is built as a series of NPM packages linked together by an NPM dependency graph.

## Table of Contents

<% for (const t of [...collections.toc].sort((a, b) => parseInt(a.url.split('/')[2].split('-')[0], 10) <  parseInt(b.url.split('/')[2].split('-')[0], 10))) { _%>
1. [<%=t.data.title%>](<%=t.url%>)
<%_ } _%>
