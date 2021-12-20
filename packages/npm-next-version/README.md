# npm-next-version
Find next version for a package.

## Installing

```sh
npm install @built/npm-next-version
```

## Using the package

The package is used internally in `built`.

```js
const npmNextVersion = require('@built/npm-next-version')

const { name, version } = require(packageDirectory);

const nextVersion = await npmNextVersion({version, name, packageDirectory});

```

## API

```js
npmNextVersion({version, name, packageDirectory})
```

* `version`: the current version of the package
* `name`: the name of the version as it appears in `package.json`
* `packageDirectory`: path to the directory of the directory where `package.json` should be found

* Returns: string of the next avbailable semver version.
