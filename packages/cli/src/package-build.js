'use strict'
const path = require('path')
const fs = require('fs')
const debug = require('debug')('bilt:cli:package-build')
const {npmNextVersion} = require('@bilt/npm-next-version')
const {sh} = require('@bilt/scripting-commons')
const o = require('./outputting')

/**@return {import('@bilt/build').BuildPackageFunction} */
function makeApplitoolsBuild(/**@type {import('@bilt/types').Directory}*/ rootDirectory) {
  /**@type import('@bilt/build').BuildPackageFunction */
  return async function applitoolsBuild({packageInfo}) {
    o.packageHeader('building', packageInfo)
    const packageDirectory = path.join(rootDirectory, packageInfo.directory)

    o.packageOperation('npm install', packageInfo)
    await sh('npm install', {cwd: packageDirectory})

    o.packageOperation('npm update', packageInfo)
    await sh('npm update', {cwd: packageDirectory})
    o.packageOperation('npm audit fix', packageInfo)
    await sh('npm audit fix', {cwd: packageDirectory})

    const packageJson = JSON.parse(
      await fs.promises.readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
    )

    const newVersion = await npmNextVersion({...packageJson, packageDirectory})
    debug('new version of', packageInfo.directory, 'is', newVersion)

    if (newVersion) {
      o.packageOperation('setting new version', packageInfo)
      await sh(`npm version ${newVersion} --allow-same-version --no-git-tag-version`, {
        cwd: packageDirectory,
      })
    }

    if ((packageJson.scripts || {}).build) {
      o.packageOperation('npm run build', packageInfo)
      await sh('npm run build', {cwd: packageDirectory})
    }

    if ((packageJson.scripts || {}).test) {
      o.packageOperation('npm test', packageInfo)
      await sh('npm test', {cwd: packageDirectory})
    }

    if (!packageJson.private) {
      const isPublic = (packageJson.publishConfig || {}).access !== 'restricted'
      o.packageOperation(`npm publish (${isPublic ? 'public' : 'restricted'})`, packageInfo)
      debug('publishing package', packageInfo.directory, isPublic ? 'publicly' : '')

      await sh(`npm publish --access=${isPublic ? 'public' : 'restricted'}`, {
        cwd: packageDirectory,
      })
    }

    return 'success'
  }
}

module.exports = makeApplitoolsBuild
