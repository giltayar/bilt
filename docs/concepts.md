# Bilt Concepts

In which Bilt concepts are enumerated and elucidated.

## Project

A monorepo consists of packages from multiple projects. A package can belong to one or more
projects.

A project is defined by the packages that belong to it, and by the top-level packages that
are needed to build it.

For example, let's say a project in a company has two microservices (`ms-a`, and `ms-b`),
a CLI (`cli-a`), and a frontend application (`fe-app`). The packages used by each are:

* `ms-a` uses `p-a`, `p-b`.
* `ms-b` uses `p-b`, `p-c`, `p-d`.
* `p-c` itself uses `p-b`
* `cli-a` uses `p-a`, `p-e`
* `fe-app` uses `p-a`

And let's assume that the monorepo also holds additional packages `p-x` and `p-y`.

The project in question has the following packages:
`ms-a`, `ms-b`, `p-c`,`cli-a`,`fe-app`, and `p-a`, `p-b`, `p-c`, `p-d`, and `p-e`. These are what
need to be built to build all the things the project needs. Specifically, `p-x` and `p-y` do NOT
need to be built in order to build the project.

Continuing our example, our project includes `.biltrc-project.json`
(assuming it's a multi-project, each project has its own configuration file), and it will be
this:

```js
{
  "packages": ["./ms-a", "./ms-b", "./p-a", /*...and all packages mentioned above */],
  "upto": ["./ms-a", "./ms-b", "./cli-a", "fe-app"]
}
```

## Package

Package is the unit of build. When we say we "build" a package,
we mean building its artifacts (JS files, static files, docker images),
testing it, and publishing it. Packages are and MUST be independently built.
Packages are related to each other via dependencies:
a package depends on zero or more packages in the monorepo.

Bilt does not allow circular dependencies between packages (yet!).

## Top-level packages

A top-level package is a package that no other package depends on. Those are the packages
we specify in the `upto` field in the `.biltrc.json`
(see the [Reference](./reference.md#upto) for more information about `upto`).

## Dependency graph

The dependency graph is a
[directed acyclic graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph) (DAG)
where the nodes of the graphs are the different packages in the repo, and the edges of the graph
(the arrows) are the dependencies between them.

Bilt does not allow circular dependencies between packages (yet!).

A project usually includes one DAG, but theoretically can include two or more unrelated
DAGs.

## Lower-level packages and higher-level packages

A package has a "height", which is its height in the dependency graph.  The lower a package is,
the more packages (recursively) depend upon it. A lower-level package
is usually an infrastructure package or utils package, and a higher-level package is more of
an application-level package.

## Build

A build has two meanings in Bilt. First and foremost, a build
is a build of a package: all the steps needed to build, test, and publish the package. This
is referred to as a "package build".

But a build is also the set of package builds needed to build all the packages in a repo due to
a code change.
