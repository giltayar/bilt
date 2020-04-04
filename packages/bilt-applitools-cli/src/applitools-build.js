'use strict'
const path = require('path')
const fs = require('fs')
const {npmNextVersion} = require('@bilt/npm-next-version')
const {sh} = require('./sh')

/**@return {import('@bilt/build').BuildPackageFunction} */
function makeApplitoolsBuild(/**@type {import('@bilt/types').Directory}*/ rootDirectory) {
  /**@type import('@bilt/build').BuildPackageFunction */
  return async function applitoolsBuild({packageInfo}) {
    const packageDirectory = path.join(rootDirectory, packageInfo.directory)

    await sh('npm install', {cwd: packageDirectory})

    await sh('npm update', {cwd: packageDirectory})
    await sh('npm audit fix', {cwd: packageDirectory})

    const packageJson = JSON.parse(
      await fs.promises.readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
    )

    const newVersion = await npmNextVersion(packageJson)

    if (newVersion) {
      await sh(`npm version ${newVersion} --allow-same-version --no-git-tag-version`, {
        cwd: packageDirectory,
      })
    }

    if ((packageJson.scripts || {}).build) {
      await sh('npm run build', {cwd: packageDirectory})
    }

    await sh('npm test', {cwd: packageDirectory})

    await sh('npm publish', {cwd: packageDirectory})

    return 'success'
  }
}

module.exports = makeApplitoolsBuild
