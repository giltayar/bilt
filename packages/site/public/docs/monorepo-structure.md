# Structure of a Bilt monorepo

In which we understand how Bilt monorepos are structured, and how to structure the
NPM packages in it.

## Bilt Monorepos are a set of NPM packages

A monorepo in Bilt is structured in a simple manner:

1. NPM packages in any directory structure. Putting all
   packages in a `packages` directory, in a flat way, is a common way to structure them, but any
   structure is OK, including a hierarchical one—bilt deals with them all.
1. Each package is a regular _publishable_ NPM package, with it's own `package.json`, including
   `name`, `version`, and usually a set of `scripts` like `build` and `test` that are used
   to build and test the package before publishing.
1. Each package should be publishable to an NPM registry. This is important because
   packages consume other packages through the regular mechanism of NPM dependencies.
1. If a package needs to generate other artifacts in other registries (such as a docker image
   for microservice packages), use `postpublish`. The recommendation is to publish it with the
   same version number as the package's.
1. The _only_ mechanism for code sharing should be through NPM dependencies. Packages should
   never directly consume another package's source code (i.e. by importing it directly).

## Build steps of a package

Each package needs to be able to be built separately. While build steps are configurable
(see [Configuring the build](../reference#configuring-build)),
the default build steps work pretty nicely for most projects:

1. `npm install` ensures all dependencies are installed
1. `npm update` updates all the dependencies.
    This is especially important in Bilt moonorepos, as it updates
    the dependencies to the other packages in the monorepo. Without `npm update`, packages
    will have outdated dependencies on the other packages in a monorepo.
1. _Increment_ version: to update the version of the package so it can be published.
   See [this](../how-bilt-works#version-increment-how) for more information.
1. `npm audit fix`. Because we're security conscious!
   (See [Snyk](https://snyk.io) for a more powerful alternative.)
1. `npm run build`: build the source code. For example transpile the code, bundle it,
   or build a docker image. This runs only if a `build` script exists in the `package.json`.
1. `npm test`: because we have tests, right? 😉 Will skip if no `test` script exists
1. `npm publish`: publishes the package

## Typical `package.json`

A `package.json` that works nicely with the build steps above looks like this:

```js
{
  "name": "@some-scope/a-microservice-in-typescript",
  "version": "1.0.10",
  // ...
  "scripts": {
     // building the code: transpiling and building the docker image
    "build": "tsc && npm run build:docker",

    // testing whatever needs to be tested
    "test": "npm run test:eslint && npm run test:mocha",

    // publish the docker image when publishing the package
    "postpublish": "npm run publish:docker",


    // sub-scripts used by the above main scripts
    "test:mocha": "mocha ...",
    "test:eslint": "eslint 'test/**/*.?s' 'test/**/*.?s'",
    // building a docker image with the same version as the package
    "build:docker": "docker build -t some-scope/a-microservice:${npm_package_version}",
    // ensuring it gets published to the docker registry along with the package
    "publish:docker": "docker push some-scope/a-microservice:${npm_package_version}"
  },
  "dependencies": {
    "some-scope/another-package-used-by-this-one": "^2.4.3",
    //...
  },
  "devDependencies": {
    "some-scope/a-build-tool-used-by-this-one": "^1.7.2s",
    // ...
  }
}
```
