<!-- markdownlint-disable MD033 -->
# How Bilt works

In which we get a deeper understanding of how Bilt works to build a monorepo.

## How Bilt determines the dependency graph

Bilt first takes the "packages" field in `.biltrc.json` and finds all the packages using the glob.
If the packages field is just "*", it autofinds all the packages by crawling the monorepo and
finding them (it's much faster than it sounds).

Once it knows what the packages are, it reads the `package.json`-s of all the packages, figures
out the dependencies, and thus creates the dependency graph of the packages.

## <a name="version-increment-how"></a>How Bilt increments the package version

Bilt cannot rely on the user to increment the package version itself (although the user can)
because it needs to build packages that the user didn't change—the packages that depend on the
packages that changed.

So Bilt increments the package version itself, but not in a blind way. It will _always_ increment
the patch version of the current version. So if the current version of the package is `2.4.5`,
it will only adjust the last (patch) segment of the version (e.g. only adjust the `.5`
in the example).

The increment is not _blind_. It does not just add 1 to the package, because theoretically there
may be a version there.

What Bilt does is look in the registry for all the existing versions of the current versions
`major.minor.*` (e.g. `2.4.1`, `2.4.2`, ....), and chooses the next version after the last version
in the chain.

So if the current version is `2.4.5`, and the existing versions in the registry are
`2.4.1 - 2.4.6`, then the increment will change it to `2.4.7`. Note that it can increment it
backward, so if the versions in the example are `2.4.1 - 2.4.3`, then the increment
will take `2.4.5` and "increment" it to `2.4.4`.

## <a name="packages-built-how"></a>How Bilt knows which packages were already built

When running a build, after determining which packages are in the dependency graph,
Bilt needs to know which packages in the dependency graph changed.

The information comes from Git.

First, we need to understand that when Bilt commits the changes you made, it will add
a `[bilt-artifacts]` text to the commit message, so that it can find it later.

In each build, Bilt scans the Git logs (a year back), and finds the last
commit of each package. Each package can have a different "last "commit. If this last
commit of the package is _not_ a Bilt commit
(checked by searching the commit message for `[bilt-artifacts]`) then the package was changed
after it was built, and so needs to be rebuilt.
