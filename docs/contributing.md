# Contributing to Bilt

Before you start contributing, let's learn a bit about the structure of the Bilt codebase.

First off, Bilt is a monorepo itself, and it is built using Bilt!
([dogfooding](https://en.wikipedia.org/wiki/Eating_your_own_dog_food) is great!) So the first
thing we need to understand, is that while the Bilt CLI is one package, it actually uses
about 10 packages overall for its functionality.

All bilt code is in the [packages](../../) directory, in a flat hierarchy. Let's go over what
those packages are. We'll go top down.

But before that, there is the site itself. You can find information
about contributing to it in the contributing doc [there](../packages/site/README.md).

## List of packages and their use

### The main "CLI" package

The main package is (`cli`)[../packages/cli]. It includes the CLI that is used to run Bilt and all
the "UI" that is needed to determine what to build, to run the build, and to show the result. The
actual logic of determining which packages to build, and determining their build order is in
three packages:

### the "build order" packages

- [`packages-to-build`](../packages/packages-to-build) is the package with the algorithm that uses
  the dependency graph to determine _which_ packages need building.
  It exports one function `calculatePackagesToBuild` which receives all
  the package information, including the dependencies, and returns an array of packages that need
  building. In order to do taht, it also gets information about the last build time of
  each package to determine whether it (and its dependents) need to be built.

- [`build`](../packages/build): once we have that information (of which packages to build), we need
  to build them in a specific order, according to the dependencies between them. This is
  what this package does. It has a main function `build` that executes a JS function
  for each package that needs to be built. It also returns success/failure information
  while it is executing about each package that was built. This is done because it is
  an "async generator" that can return information to the caller _while it is executing_.

- [`build-with-configuration`]: this package determines _what_ to do on each step of the build.
  It can read the configuration (`.biltrc`) determine the steps to invoke before the build
  of the packages, the steps for each package, and what to do after the package is built. It
  is the package that is responsible for running the build of a package.

To truly understand the algorithms in these packages, see [How Bilt Works](./how-bilt-works.md).
But, frankly, most of the code their is done, and the features and bugs are elsewhere.

### The "info" packages

These packages are lower-level still and support CLI in its quest to give the correct information
that the "build order" packages need. That information is around i) dependencies, and ii) last
build time. So... NPM information and Git information. Which brings me to the packages:

- [`npm-packages`](../packages/npm-packages): the main function in this package
  is `findNpmPackageInfos`, which, given a set of package directories, finds the name, version, and dependencies of each package.
- [`git-packages`](../packages/git-packages): the main function in this package is
  `findLatestPackageChanges` that returns the list of packages, and their last build time,
  according to information in Git (see [How Bilt Works](./how-bilt-works.md)
  to understand how it does that).

Another package is [`npm-next-version`](../packages/npm-next-version):
this package is used by Bilt in the _default_ build steps it has,
and its purpose is to determine what the "next" version of a package should be when it is published.

### The "types" package

[This package](../packages/types) includes TypeScript types that are used by
all of the above packages. I usually dislike packages that have stuff for _all_ packages,
but, hey, we're all human, right? I've tried distributing the types more as time goes by,
and not adding any more types here.

### The testkits

There's a lot of testing being done in the codebase, and to support that, we have the "testkit"
packages, which are packages that have functionality needed for testing.

- [`npm-testkit`](../packages/npm-testkit): used to test functionality around npm install and
  publish. Exports the `startNpmRegistry` function that starts an NPM registry ([Verdaccio](https://verdaccio.org/),
  that can be used by whatever `npm install/publish` code you have to publish to it. This is used
  because publishing to the public npm registry just to check functionality just doesn't make sense.
- [`git-testkit`](../packages/git-testkit): used to create git repositories and manipulate them.
  Many small utilities around git.

### The infra packages

- [`scripting-commons`](../packages/scripting-commons): a package including code that executes
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

To see whether it works, just do `bilt --version`.

## Developing in a branch

When using Bilt, you are constantly publishing packages in this monorepo, so that other packages
can use them. When developing in the `main` branch, that makes sense, but it does _not_ make sense
when developing in a branch, i.e. in a Pull Request. To deal with that, the usual method is
to run an NPM registry locally, and to ensure that all Bilt packages are published to it. For this,
there is a special directory, `dev` that has scripts to enable this. So before developing,
do the following:

```shell
# from the root of the repository
cd dev
npm install
npm run develop-in-branch
```

This will run Verdaccio (an NPM registry), and ensure that all publishes of `bilt` packages
will publish to it and not to the public NPM registry. Now you can develop to your hearts content.
It is important not to close the window that ran this registry, so that it will always run while
you're developing.

To kill Verdaccio and restore everything to what it was, do:

```shell
# from the root of the repository
cd dev
npm run develop-in-main
```

Now let's go over the structure of a package to see how to develop in one package:

## Developing one package

Now that we've gotten past the responsibility of each package, let's discuss each package. All
packages have the exact same structure, and the exact same lifecycle.
Let's talk about the lifecycle, meaning how do I install, build, test, and publish them:

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

1. Create a branch and a Pull Request, in regular OSS manner.
1. Write code.
1. Write tests that check the code.
1. Run the tests and fix the code until they pass (see below on how to run the tests).
1. Done? Run `bilt . -m "<commit-message>"` on the package.
   - Remember running `npm run develop-in-branch`? That command makes sure that when bilt
     builds the package, it will publish it only to the local registry and not to the global
     public NPM registry.
1. This will also commit and push your changes, and the CI will build all of Bilt based on your
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
it.only("should do something great", () => {});
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
before pushing. Tip: a good way of not forgetting is to add a comment to the console.log
in the form of `// @@@<name>`.
The `@@@` in the comment will cause ESLint to fail, so it won't let you push the change.

### Pushing the change

While theoretically you can `git commit` and `git push` yourself, the best and safest way
to do it would be to use `bilt` itself:

```shell
bilt .  -m "<commit message>"
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
1. `npm publish` to publish the package. Remember, we ran a local registry so that this publish
   won't go to the global NPM registry, but rather to the local one running on your machine.
1. `git add . && git commit` to commit the changes in this directory
1. `git push` to push the changes

This is, in essence, a full build of only that package, and it's best to use Bilt to ensure
that a full build passes. Don't worry: it usually takes less than a minute.

Once your code is pushed, Bilt in CI will wake up and build all the dependencies of that package,
assuming there are any. For example, if you changed the `build-with-configuration` and pushed it,
CI will also build the `cli` package, because the `cli` package
depends on `build-with-configuration`.

To see the build you triggered in action, and to ensure it doesn't fail,
goto the "Actions" tab in the Github monorepo: <https://github.com/giltayar/bilt/actions>.

### Working with two packages in tandem

What if a bug or a feature spans two packages? This definitely _does_ happen, although
not as commonly as you would think.

There are two ways to do that. Let's take an example. Let's say you want to add
functionality to the `cli` package, but for that you want to add a function to `scripting-commons`.
In other words, you want to develop the `cli` and `scripting-commons` together.

The recommended way is to first add the functionality to `scripting-commons`, write the tests,
make them run, and then Bilt it using `bilt . -m "<commit message>"`. This will publish the
package to the local NPM registry you installed previously. Now that you've finished doing that,
you can goto the `cli` package, and run `npm update` to update the `scripting-commons` dependency
to the newer version, and continue with the feature there.

The alternative, but less recommended way, is to use
[`npm link`](https://docs.npmjs.com/cli/v7/commands/npm-link).
This command links two packages together.
The only thing you need to do here is execute the following:

```shell
cd packages/cli
npm link ../scripting-commons
```

This will link `cli` to `scripting-commons`: any changes you do to `scripting-commons` will
immediately be seen by `cli`.

> Note: any `npm install` you run in `cli` will erase the link and you will go back to using
> the latest `scripting-commons` in the registry.
> Also note: when you change the type signature of something in `scripting-commons`, you should
> run `npm run build` there so that the `.d.ts` files will be regenerated,
> so that `cli` can see the new type signature (see ["JSDoc typing"](#jsdoc-typing) below).
> Also note: don't try to do it on more than two packages, because Node and NPM get confused
> if there are too many links.

## The source code of Bilt packages

Let's look at the source code of Bilt packages. The structure of them all is the same, so
we'll take [`cli`](../packages/cli) as an example.

The two most important directories there are `src` and `test`. `src` will include all
source code of the package, and `test` will include the tests for the package.

The third most important file is `package.json`, which you all know, and which
points to the main file of the package (the "entry point" to the package, which is what
we run when we `import` the package), and which includes all dependencies and dev dependencies.

There are also lots of configuration files in the root directory, most of them "dotfiles" (i.e.
starting with "dot"). You can usually ignore them.

### `src`

The main file here is `cli.js`. If you look at the `package.json` "main", you will see that this
file is the entry point to the package and is what you import when you `import` the package.
All the other source files in `src` are usually `import`-ed directly or indirectly by `cli.js`.

The `bilt` package is a bit different in that it includes another "entry point": `run-bilt.js`.
This is what is executed when you run `bilt` in the command line (you can see that the
`package.json` has `"bin"` that points to it). But `run-bilt.js` is a small wrapper that
just imports and calls the main function in `bilt.js`, so you can usually safely ignore it.

To understand the `bilt` CLI and how it works, goto the design of CLI in
[`design.md`](../packages/cli/docs/design.md)

All source code is written in JavaScript, but has JSDocs that give full type information that
is typechecked by TypeScript. See ["JSDoc Typing"](#jsdoc-typing) below. It also doesn't use
CommonJS (`require(...)`) to import modules and packages, but rather the newer ESM that
uses `import` to do that. See ["ESM"](#esm) for more information.

## `test`

The test directory includes subdirectories for the three main types of tests. Not all packages
include all kinds of tests. The three types are:

- `unit`: simple tests that test one function or one simple module. Easiest to understand
  and easiest to add to, but give the least confidence.
- `integ`: "integration" tests that tests part or all of a package, using internal interfaces.
  For example, in `cli`, it will test the command line through the function in `cli.js` and not by executing the `run-cli.js` process, as a user would.
- `e2e`: tests the whole package, as a user would. In the `cli` case, it runs the `run-cli.js`
  as a process and checks the output. We try to minimize the number of e2e tests to a mininum
  and have most tests be `integ` or `unit`.

Bilt uses [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/api/bdd/)
for all its testing.

## JSDoc Typing

All source code in all Bilt packages uses JSDoc typing, to fully typecheck the code with
TypeScript, but without the need to transpile. To understand how to use JSDoc Typing,
read
[this](https://gils-blog.tayar.org/posts/jsdoc-typings-all-the-benefits-none-of-the-drawbacks/).

But don't worry: you can incrementally learn about it, and it should be usually pretty
straightforward, especially if you've used TypeScript in the past. One thing you should NOT
do is use `//@ts-ignore-error` to ignore typechecking errors, unless you know that this is fine.
I would suggest DM-ing one of the maintainers of the project if you feel a `//@ts-ignore-error`
is warranted. In 99% of the cases, it isn't.

## ESM

Bilt also uses the new ES Modules support in Node.js (which is why it won't work in Node.js
versions less than 12). If you want to learn more about it, read about it
[here](https://gils-blog.tayar.org/posts/using-jsm-esm-in-nodejs-a-practical-guide-part-1/).

Two rules to remember:

1. When you import another file, you must include the extension of the file:

   ```js
   import './another-file' // ERROR: won't work!
   import './another-file.js` // Yay!!!
   ```

1. You _can_ import packages that are not ESM, but if you're using named imports
   e.g. `import {namedImport} from 'some-package`, then for some packages you may get
   an error saying you can't import them using named imports. In that case, do the following:

   ```js
   import somePackage from "some-package";
   const { namedImport } = somePackage;
   ```

## Coding style guidelines

- Function and variable names can (and should be) as long as needed to explain what's in them.
  Don't hesitate to go overboard with long names. Definitely no shortcuts. The one
  exception are parameter names for small anonymous functions that you pass to `filter` and `map`,
  because in that case, the parameter is obvious from usage.

- The code should "breath": separate functionality in a function with an empty line. Separate
  the variable declarations from the code with an empty line. Let the code "breath" by not having
  it cramped together.

## Continuing from here

That's it for the guide! If you want to dive into the codebase, I would recommend
understanding the topmost package: `cli`, by reading its design document
[here](../packages/cli/docs/design.md).
