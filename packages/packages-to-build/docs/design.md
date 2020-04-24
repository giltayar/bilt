# Design of packages-to-build

## Calculating set of packages to build

Given `basePackagesToBuild` (Here they will be called `from`), and `buildUpto` (here they will be
called `upto`), this algorithm calculates which packages to build.

Note that if `upto` === undefined, then by definition we set `upto` to be `from`.

Each of the packages will have the additional info:

1. `dependencies`: the list of packages it depends on directly. From this, a "dependency graph" (a
   DAG) can be built.
2. `lastCommitTime`: a unix timestamp of the last commit time, called "commit time" for short
3. `lastBuildTime`: a unix timestamp of the last succesful build tiem of the package, called "build
   time" for short

### The invariants

1. A package will be built iff it is in the graph subset that links all the uptos to the froms in the
  dependency graph. In other words, one of its predecessors (recursive) MUST be one of the uptos,
  and one of its descendants (recursive) MUST be one of the froms.
2. A package will be built if its last commit is larger than its last build.
3. A package will be built if its last build is smaller than one of the last builds of its
  dependencies.
4. A package will be built if a package that it depends will be built.

### The algorithmֿ

The steps of the algorithm:

#### 1. Building the "linked graph subset"

First, we build the "linked graph subset", which is a subset of the dependency graph that includes
all packages that can be built, given the froms and the uptos.

This takes care of the 1st invariant.

1. Using DFS, find the packages that link from all the uptos.
1. Remove all nodes not in that list (this includes the from nodes not in that list).
1. For each upto:
   1. Find the packages that link from that upto (using DFS).
   1. If none of the froms are in that list of packages, remove that upto.
1. Using DFS, again find the packages that link from all the uptos.
1. Remove all nodes not in that list.

Alternatively:

1. Using Djikstra, calculate the length of the path from each node to each other node
1. For each node N:
   1. If one of the from nodes has some finite length from N, keep N
   2. If one of the to nodes has some finite length to N, keep N
   3. Otherwise remove N

#### 2. Mark all packages that directly ("obviously") need to be built

This takes care of the 2nd and 3rd invariant.

1. For each package:
   1. Mark it if its commit time > build time
   1. Mark it if one of its dependencie's build time > its build time

#### 3. Mark all graphs that indirectly (through the depenedency chain) need to be built

This takes care of the 4th invariant.

1. Using Djikstra, calculate the length of the path from each node to each other node
1. If a node has marked nodes that lead from it, mark it

#### 4. Return nodes

Return all marked nodes.
