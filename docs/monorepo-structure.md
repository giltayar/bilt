# Structure of a Bilt monorepo

In which we understand how Bilt monorepos are structured, and how to structure each
NPM package in it.

## Bilt Monorepos are a set of NPM packages

A monorepo in Bilt is structured in a simple manner:

1. Have NPM packages in any folder structure you want. I've found that putting all
   packages in a `packages` folder, in a flat way, is a good way to structure it, but you can
   go all hierarchical if you want—bilt doesn't care.
1. Each package should be a regular NPM package, with it's own `package.json`, including
   `name`, `version`, and usually a set of `scripts` like `build` and `test` that are used
   to build and test the package before publishing.
1. Each package should be publishable to an NPM registry. This is important because other
   packages consume other packages through the regular mechanism of NPM dependencies.
1. If a package needs to generate other artifacts in other registries (such as a docker image
   for microservice packages), use `postpublish`, and we recommend to publish it with the
   same version number as the package's.
1. The _only_ mechanism for code sharing should be through NPM dependencies. Packages should
   never directly consume another package's source code (e.g. by importing it directly).

## Build steps of a package

Each package needs to be able to be built separately. While you can configure
different build steps if you want
(see [Configuring the build](./docs/reference.md#configuring-build)),
the default build steps work pretty nicely for most projects:

1. `npm install` to ensure all dependencies are installed
1. `npm update` to update all the dependencies.
    This is especially important in Bilt, as it updates
    the dependencies of the other packages in the monorepo. Without `npm update`, you will
    be depending on an older version of your packages.
1. _Increment_ version: the patch level version of the package will be updated to the next
   available patch level for the current `major.minor` version defined in the `package.json`.
   See [this](./how-bilt-works.md#version-increment-how) for more information.
1. `npm audit fix`. Because we're security conscious.
1. `npm run build`: build the source code, for example transpile the code, bundle it,
   or build a docker image. This will be run only if a `build` script exists in the `package.json`.
1. `npm test`: because we have test, right? 😉 Will skip if no `test` script exists
1. `npm publish`: publishes the package

## Typical `package.json`

So configure your packages so the above build will work. A typical `package.json` that works
well will be something like this:

```js
{
  "name": "@some-scope/a-microservice-in-typescript",
  "version": "1.0.10",
  // ...
  "scripts": {
     // building the code
    "build": "tsc",
     // ensuring the docker image also gets built when building the code
    "postbuild": "'npm run build:docker",

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
