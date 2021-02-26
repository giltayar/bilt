# Contributing to Bilt

Before you start contributing, let's learn a bit about the structure of the Bilt codebase.

First off, Bilt is a monorepo itself, and it is built using Bilt!
([dogfooding](https://en.wikipedia.org/wiki/Eating_your_own_dog_food) is great!) So the first
thing we need to understand, is that while the Bilt CLI is one package, it actually uses
about 10 packages overall for its functionality.

All bilt code is in the [packages](../../) directory, in a flat hierarchy. Let's go over what
those packages are. We'll go top down.

## List of packages and their use

### The main "CLI" package

The main package is (`cli`)[../cli]. It includes the CLI that is used to run Bilt and all
the "UI" that is needed to determine what to build, to run the build, and to show the result. The
actual logic of determining which packages to build, and determining their build order is in
three packages:

### the "build order" packages

- [`packages-to-build`](../packages-to-build) is the package with the algorithm that uses
  the dependency graph to determine _which_ packages need building. It exports one function `calculatePackagesToBuild` which receives all
  the package information, including the dependencies, and returns an array of packages that need
  building. In order to do taht, it also gets information about the last build time of
  each package to determine whether it (and its dependents) need to be built.

- [`build`](../build): once we have that information (of which packages to build), we need
  to build them in a specific order, according to the dependencies between them. This is
  what this package does. It has a main function `build` that executes a JS function
  for each package that needs to be built. It also returns success/failure information
  while it is executing about each package that was built. This is done because it is
  an "async generator" that can return information to the caller _while it is executing_.

- [`build-with-configuration`]: this package determines _what_ to do on each step of the build.
  It can read the configuration (`.biltrc`) determine the steps to invoke before the build
  of the packages, the steps for each package, and what to do after the package is built. It
  is the package that is responsible for running the build of a package.

To truly understand the algorithms in these packages, see see [How Bilt Works](./how-bilt-works.md).
But, frankly, most of the code their is done, and the features and bugs are elsewhere.

### The "info" packages

These packages are lower-level still and support CLI in its quest to give the correct information
that the "build order" packages need. That information is around i) dependencies, and ii) last
build time. So... NPM information and Git information. Which brings me to the packages:

- [`npm-packages`](../npm-packages): the main function in this package is `findNpmPackageInfos`,
  which, given a set of package directories, finds the name, version, and dependencies
  of each package.
- [`git-packages`](../git-packages): the main function in this package is `findLatestPackageChanges`
  that returns the list of packages, and their last build time, according to information
  in Git (see [How Bilt Works](./how-bilt-works.md) to understand how it does that).

Another package is [`npm-next-version`](../npm-next-version):
this package is used by Bilt in the _default_ build steps it has,
and its purpose is to determine what the "next" version of a package should be when it is published.

### The "types" package

[This package](../types) includes TypeScript types that are used by all of the above packages. I usually
dislike packages that have stuff for _all_ packages, but, hey, we're all human, right? I've
tried distributing the types more as time goes by, and not adding any more types here.

### The testkits

There's a lot of testing being done in the codebase, and to support that, we have the "testkit"
packages, which are packages that have functionality needed for testing.

- [`npm-testkit`](../npm-testkit): used to test functionality around npm install and publish.
  Exports the `startNpmRegistry` function that starts an NPM registry (Verdaccio), that can be
  used by whatever `npm install/publish` code you have to publish to it. This is used
  because publishing to the public npm registry just to check functionality just doesn't make sense.
- [`git-testkit`](../git-testkit): used to create git repositories and manipulate them. Many
  small utilities around git.

### The infra packages

- [`scripting-commons`](../scripting-commons): a package including code that executes
  processes, creates temporary directories, and reads and write files, all in a nice and easy
  to use way.

## Developing in the monorepo

While you could use any IDE/Editor, I recommend
[Visual Studio Code](https://code.visualstudio.com/) as their is specific stuff in the monorepo
for this editor. The explanations in this page assume VSCode.

To code, open VSCode, and open the [workspace](https://code.visualstudio.com/docs/editor/workspaces)
file in the root of the repo. This will open a workspace with all the packages
as projects in the workspace. I would heartily recommend installing the
[ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
because all packages in the monorepo use ESLint and it's nice to see the warnings and errors
as you code. I would also recommend installing the
[Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
for the same reason.

Note that ESlint won't work until you `npm install` the package with the code, because the ESlint
extension uses the local ESLint of the package.

Once you've opened the workspace, it's time to also install Bilt itself, because Bilt is used
to build Bilt (say it fast 10 times!). That's easy. Just:

```shell
npm install -g @bilt/cli
```

To try it out, just do `bilt --version`.

Now let's go over the structure of a package to see how to develop in one package

## Developing one package

Now that we've gotten past the responsibility of each package, let's discuss each package. All
packages have the exact same structure, and the exact same lifeccle. Let's talk about the lifecycle,
meaning how do I install, build, test, and publish them.

### Installing a package

When you first want to start working with a package, you need to install all dependencies. The
usual will work:

```shell
npm install
```

Now you're ready to code. Once you've `npm install`-ed it, you can start
coding and running the tests. Bilt was developed with a very simple methodology in mind: you never
run Bilt to see that it works. Rather, you write tests to ensure that the code you wrote works.

So the methodology is simple:

1. Create a branch and a Pull Request, in regular OSS manner
1. Write code
1. Write tests that check the code
1. Run the tests and fix the code until they pass (see below on how to run the tests)
1. Done? Run `bilt --no-publish` on the package, just to ensure that everything's OK. You
   don't want to publish because this is a pull request.
1. This will also  commit and push your changes, and the CI will build all of Bilt based on your
   change.

### Running the tests

There are two methods to run the test: a "full" one, and a "quick" one. The full one is to run

```shell
npm test
```

This will _concurrently_ run ESLint, TypeScript (why TypeScript? See below),
and the Mocha tests (that are _also_ run in parallel). This is great for CI, and for ensuring that _everything_ passes, but bad for day to day development.
To run _only_ the Mocha tests, and serially, use `npm run mocha -- -b` (I have an alias called
`qt` for that). The `-b` tells Mocha to bail and stop on the first test failure.

Also, usually, I am working on a single test, and it's nice to run just _that_ test instead
of all of them. To do that, goto that test in the code, and add `.only` to the `it`:

```js
  it.only('should do something great', () => {

  })
```

This tells Mocha to run only _that_ test. You can also attach a `.only` to the `describe` to run
a group of tests.

### Debugging

Since we're running our code via tests, I created a launch configuration that runs
Mocha on that package. To run it, goto the Debug pane in VSCode, and choose the configuration
"Mocha Tests (\<name-of-package>)". Now put breakpoints wherever you want, and launch the debugger,
either by clicking on the "run" icon or by pressing \<F5>.

The debugger will run all the tests (you will probably have a `.only` somewhere to run only
one test), and stop on your breakpoint. Now start debugging with ease!

Of course, `console.log`-ing your way also works... 😎. Just don't forget to remove them
before pushing. A good way of not forgetting is to add a comment to the console.log in the form of
 `// @@@<name>`. The `@@@` in the comment will cause ESLint to fail, so it won't let you push the
 change.

### Pushing the change

While theoretically you can `git commit` and `git push` yourself, the best and safest way
to do it would be to use `bilt` itself:

```shell
bilt .  --no-publish -m "<commit message>"
```

The `.` in the command tells Bilt to build only the current package. What it will do is:

1. `npm install`
1. `npm update` to update all dependencies in the code
   (it does only semver-minor updates, which are 99.99% of the time safe)
1. Update the version of the package using `npm-next-version`
1. `npm run build` to run whatever build steps are necessary. All the packages in Bilt only
   use this step to generate `.d.ts` files for TypeScript use (see below section on TypeScript
  to understand what this means). If you have a type error that TypeScript catches, it will catch
  it here.
1. `npm test` to run all the tests. This runs ESLint, TypeScript, and Mocha in parallel (to save
   time)
1. `npm publish` to publish the package. You *don't* want to do that, which is why we add
   `--no-publish` to the build command.
1. `git add . && git commit` to commit the changes in this directory
1. `git push` to push the changes

This is, in essence, a full build of only that package, and it's best to use Bilt to ensure
that a full build passes. Don't worry: it usually takes less than a minute.

Once your code is pushed, Bilt in CI will wake up and build all the dependencies of that package,
assuming there are any. To see the build in action, and to ensure it doesn't fail,
goto the "Actions" tab in the Github monorepo: <https://github.com/giltayar/bilt/actions>.

### JSDoc Typing and TypeScript

### Working with two packages in tandem

