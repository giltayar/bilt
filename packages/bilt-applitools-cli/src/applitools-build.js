'use strict'
const path = require('path')
const fs = require('fs')
const {once} = require('events')
const {spawn} = require('child_process')
const {npmNextVersion} = require('@bilt/npm-next-version')

/**@return {import('@bilt/build').BuildPackageFunction} */
function makeApplitoolsBuild(/**@type {import('@bilt/types').Directory}*/ rootDirectory) {
  /**@type import('@bilt/build').BuildPackageFunction */
  return async function applitoolsBuild({packageInfo}) {
    const packageDirectory = path.join(rootDirectory, packageInfo.directory)

    await sh('npm install')

    await sh('npm update')
    await sh('npm audit fix')

    const packageJson = JSON.parse(
      await fs.promises.readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
    )

    const newVersion = await npmNextVersion(packageJson)

    if (newVersion) {
      await sh(`npm version ${newVersion} --allow-same-version --no-git-tag-version`)
    }

    if ((packageJson.scripts || {}).build) {
      await sh('npm run build')
    }

    await sh('npm test')

    await sh('npm publish')

    return 'success'

    async function sh(command) {
      const childProcess = spawn(command, {cwd: packageDirectory, stdio: 'inherit'})

      const [[exitCode], [error]] = await Promise.race([
        once(childProcess, 'error'),
        once(childProcess, 'exit'),
      ])

      if (error) {
        throw error
      } else if (exitCode !== 0) {
        throw new Error(`'${command}' failed with exit code ${exitCode}`)
      }
    }
  }
}

module.exports = makeApplitoolsBuild
