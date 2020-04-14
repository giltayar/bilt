# Bilt Concepts

In which Bilt concepts are enumerated and elucidated.

## Project

A monorepo consists of packages from multiple projects. A package can belong to one or more
projects.

A project is defined by the packages that belong to it, and by the top-level packages that
are needed to build it.

For example, let's say a project in a company has two microservices (`ms-a`, and `ms-b`),
a CLI (`cli-a`), and a frontend application (`fe-app`). The packages used by each will be thos:

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

Continuing our example, our project will include `.biltrc-project.json`
(assuming it's a multi-project, each project has its own configuration file), and it will be
this:

```js
{
  "packages": ["./ms-a", "./ms-b", "./p-a", /*...and all packages mentioned above */],
  "upto": ["./ms-a", "./ms-b", "./cli-a", "fe-app"]
}
```

## Package

Package is the unit of build. We "build" a package. Packages are related to each other
as dependencies: a package depends on zero or more packages in the monorepo.

Bilt does not allow circular dependencies between packages (yet!).

## Top-level packages

A top-level package is a package where no other packages depend on it. Those are the packages
you need to specify in the "upto" field in the `.biltrc.json`.

## Dependency graph

The dependency graph is a
[directed acyclic graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph) (DAG)
where the nodes of the graphs are the different packages in the repo, and the edges of the graph
(the arrows) are the dependencies between them.

Bilt does not allow circular dependencies between packages (yet!).

Actually, a project usually includes one DAG, but theoretically can include two or more unrelated
DAGs. Bilt also supports that.

## Lower-level packages and higher-level packages

A package has a "height", which is its height in the dependency graph. A lower-level package
is usually some infrastructure package or utils package, and a higher-level package is more of
an application-level package.

## Build

A build has two meanings in Bilt, which uses it in two meanings. First, and foremost, a build
is a build of a package: all the steps needed to build, test, and publish the package.

But a build is also a set of package builds needed to build all the packages in a repo.
