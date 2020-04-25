<!-- markdownlint-disable MD033 -->
# How Bilt works

In which we get a deeper understanding of how Bilt works to build a monorepo.

## How Bilt determines the dependency graph

Bilt first takes the `packages` field in `.biltrc.json` and finds all the packages using the glob.
If the `packages` field is just "*", it auto-discovers all the packages by crawling the monorepo and
finding them (it's much faster than it sounds).

Once it determined the list of packages, it reads the `package.json`-s of all the packages, figures
out the dependencies from the `dependencies` and `devDependencies` in them,
and creates the dependency graph of the packages based on those relationships.

Once it has this information, including when each commit was built last (see [How Bilt knows which
packages were already built](#how-bilt-knows-which-packages-were-already-built)), it builds a subset
of the dependency graph, including only those packages it needs to build, while keeping the
following invariants:

1. A package will be built iff it is in the graph subset that links all the uptos to the froms in the
  dependency graph. In other words, one of its predecessors (recursive) MUST be one of the uptos,
  and one of its descendants (recursive) MUST be one of the froms.
2. A package will be built if it is dirty
3. A package will be built if its last build is smaller than one of the last builds of its
  dependencies or if one of its packages is dirty.
4. A package will be built if a package that it depends will be built.

For more information on the design of how Bilt determines which packages to build, see
[the design document for
`@bilt/packages-to-build`](./packages/packages-to-build/docs/design.md#calculating-set-of-packages-to-build).

## <a name="version-increment-how"></a>How Bilt increments the package version

Bilt cannot rely on the developer to increment the package version (although the developer can)
because it needs to build packages that the developer didn't change—the packages that depend on the
packages that changed.

So Bilt increments the package version itself, but in a smart way: so if the current version of
the package is `2.4.5`, it will only adjust the last (patch) segment of
the version (e.g. only adjust the `.5` in the example).

The increment is not _blind_. It does not just add 1 to the package, because theoretically there
may already be a published version with that number.

Instead, Bilt searches the NPM registry for all the existing versions of the current versions
`major.minor.*` (e.g. `2.4.1`, `2.4.2`, ....), and chooses the next version after the last version
in the chain.

So if the current version is `2.4.5`, and the existing versions in the registry are
`2.4.1 - 2.4.6`, then the increment will change it to `2.4.7`. Note that it can "increment" it
backwards, so if the versions in the example are `2.4.1 - 2.4.3`, then the increment
will take `2.4.5` and "increment" it to `2.4.4`.

## <a name="packages-built-how"></a>How Bilt knows which packages were already built

When running a build, after determining which packages are in the dependency graph,
Bilt needs to know which packages in the dependency graph changed.

The information comes from Git.

First, we need to understand that when Bilt commits the changes you made, it will add
a `[bilt-with-bilt]` text to the commit message, so that it can find it later.

In each build, Bilt scans the Git logs (a year back), and finds the last
commit of each package. Each package can have a different "last "commit. If this last
commit of the package is _not_ a Bilt commit
(checked by searching the commit message for `[bilt-with-bilt]`), then the package was changed
after it was built, and so needs to be rebuilt.
