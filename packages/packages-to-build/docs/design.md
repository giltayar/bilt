# Design of packages-to-build

## Calculating set of packages to build

Given `basePackagesToBuild` (Here they will be called `from`), and `buildUpto` (here they will be
called `upto`), this algorithm calculates which packages to build.

Note that if `upto` === undefined, then by definition we set `upto` to be `from`.

Each of the packages will have the additional info:

* `dependencies`: the list of packages it depends on directly. From this, a "dependency graph" (a
   DAG) can be built.
* `lastBuildTime`: a unix timestamp of the last successful build time of the package.
* `isDirty`: the package was changed since it was last built.

### The invariants

1. A package will be built if it is in the graph subset that links all the uptos to the froms in the
  dependency graph. In other words, one of its predecessors (recursive) MUST be one of the uptos,
  and one of its descendants (recursive) MUST be one of the froms.
2. A package will be built if it is dirty.
3. A package will be built if its last build is smaller than one of the last builds of its
  dependencies or if one of its packages is dirty.
4. A package will be built if a package that it depends will be built.

### The algorithmֿ

The steps of the algorithm:

#### 1. Building the "linked graph subset"

First, we build the "linked graph subset", which is a subset of the dependency graph that includes
all packages that can be built, given the froms and the uptos.

This takes care of the 1st invariant.

1. Using Djikstra, calculate the length of the path from each node to each other node
1. For each node N:
   * If one of the from nodes has some finite length from N, and...
   * one of the to nodes has some finite length to N...
   * keep N
   * Otherwise remove N

#### 2. Mark all packages that directly ("obviously") need to be built

This takes care of the 2nd and 3rd invariant.

1. For each package in the linked graph subset:
   1. Mark it if it's dirty
   1. Mark it if one of its dependency's `isDirty` or the dependency's `lastBuildTime` > its
      `lastBuildTime`

#### 3. Mark all graphs that indirectly (through the depenedency chain) need to be built

This takes care of the 4th invariant.

1. Using Djikstra, calculate the length of the path from each node to each other node
1. If a node has marked nodes that lead from it, mark it

#### 4. Return nodes

Return all marked nodes.
