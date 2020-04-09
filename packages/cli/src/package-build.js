'use strict'
const {promisify} = require('util')
const path = require('path')
const fs = require('fs')
const debug = require('debug')('bilt:cli:package-build')
const {npmNextVersion} = require('@bilt/npm-next-version')
const {exec} = require('child_process')
const sh = promisify(exec)

/**@return {import('@bilt/build').BuildPackageFunction} */
function makeApplitoolsBuild(/**@type {import('@bilt/types').Directory}*/ rootDirectory) {
  /**@type import('@bilt/build').BuildPackageFunction */
  return async function applitoolsBuild({packageInfo}) {
    const packageDirectory = path.join(rootDirectory, packageInfo.directory)

    debug('installing', packageInfo.directory)

    await sh('npm install', {cwd: packageDirectory})

    debug('updating', packageInfo.directory)
    await sh('npm update', {cwd: packageDirectory})
    debug('audit fixing', packageInfo.directory)
    await sh('npm audit fix', {cwd: packageDirectory}).catch((error) => {
      if (error.stderr.includes('ENOAUDIT')) {
        debug('npm registry does not support auditing')
      } else {
        throw error
      }
    })

    const packageJson = JSON.parse(
      await fs.promises.readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
    )

    const newVersion = await npmNextVersion({...packageJson, packageDirectory})
    debug('new version of', packageInfo.directory, 'is', newVersion)

    if (newVersion) {
      debug('setting new version', packageInfo.directory)
      await sh(`npm version ${newVersion} --allow-same-version --no-git-tag-version`, {
        cwd: packageDirectory,
      })
    }

    if ((packageJson.scripts || {}).build) {
      debug('npm run build', packageInfo.directory)
      await sh('npm run build', {cwd: packageDirectory})
    }

    debug('npm test', packageInfo.directory)
    await sh('npm test', {cwd: packageDirectory})

    if (!packageJson.private) {
      const isPublic = (packageJson.publishConfig || {}).access !== 'restricted'
      debug('publishing package', packageInfo.directory, isPublic ? 'publicly' : '')

      await sh(`npm publish --access=${isPublic ? 'public' : 'restricted'}`, {
        cwd: packageDirectory,
      })
    }

    return 'success'
  }
}

module.exports = makeApplitoolsBuild
