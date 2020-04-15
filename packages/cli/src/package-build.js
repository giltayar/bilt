'use strict'
const path = require('path')
const o = require('./outputting')
const {executeJob} = require('@bilt/build-with-configuration')

/**@return {import('@bilt/build').BuildPackageFunction} */
function makePackageBuild(
  /**@type {import('@bilt/build-with-configuration/src/types').BuildConfiguration} */ buildConfiguration,
  /**@type {import('@bilt/types').Directory}*/ rootDirectory,
  /**@type {{[x: string]: string|boolean}} */ buildOptions,
) {
  /**@type import('@bilt/build').BuildPackageFunction */
  return async function ({packageInfo}) {
    const packageDirectory = path.join(rootDirectory, packageInfo.directory)

    for await (const stepInfo of executeJob(
      buildConfiguration['build'],
      'after',
      packageDirectory,
      buildOptions,
    )) {
      o.packageOperation(stepInfo.name, packageInfo)
    }

    return 'success'
  }
}

module.exports = makePackageBuild
