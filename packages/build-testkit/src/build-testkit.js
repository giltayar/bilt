'use strict'
const fs = require('fs')
const path = require('path')

/**@return {import('@bilt/build').BuildPackageFunction} */
function logFilesDuringBuild(
  /**@@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@@type {{[x: string]: string}*/ logLines,
) {
  return async function (
    /**@type {{packageInfo: import('@bilt/types').PackageInfo}}*/ {packageInfo},
  ) {
    const directory = path.join(rootDirectory, packageInfo.directory)

    const files = await fs.promises.readdir(directory)

    for (const file of files) {
      if (file === 'package.json') continue
      logLines[path.join(packageInfo.directory, file)] = await fs.promises.readFile(
        path.join(directory, file),
        'utf-8',
      )
    }

    return 'success'
  }
}

module.exports = {
  logFilesDuringBuild,
}
