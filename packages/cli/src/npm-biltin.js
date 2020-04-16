'use strict'
const fs = require('fs')
const path = require('path')
const {npmNextVersion} = require('@bilt/npm-next-version')

/**
 *
 * @param {string} packageDirectory
 * @returns {Promise<string>}
 */
async function nextVersion(packageDirectory) {
  const packageJson = JSON.parse(
    await fs.promises.readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
  )

  const nextVersion = await npmNextVersion({...packageJson, packageDirectory})

  return nextVersion
}

module.exports = {
  npm: {
    nextVersion,
  },
}
