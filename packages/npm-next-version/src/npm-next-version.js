'use strict'
const {promisify: p} = require('util')
const {execFile} = require('child_process')
const calculateNextVersion = require('./calculate-next-version')

/**
 * @param {{version: string, name: string}} options - you can pass a packageJson too. It has the right properties.
 * @returns {string} the version that should be published
 */
async function npmNextVersion({version, name}) {
  const registryPackageinfo = await getRegistryPackageInfo(name)

  const registryVersions =
    registryPackageinfo === undefined ? [] : normalizeVersions(registryPackageinfo.versions)

  return calculateNextVersion(version, registryVersions)
}

async function getRegistryPackageInfo(packageName) {
  try {
    const {stdout} = await p(execFile)('npm', ['view', '--json', packageName])
    if (!stdout) return undefined

    return JSON.parse(stdout)
  } catch (err) {
    if (JSON.parse(err.stdout).error.code === 'E404') {
      return undefined
    }

    throw err
  }
}

function normalizeVersions(versions) {
  return (versions || []).concat(versions)
}

module.exports = {
  npmNextVersion,
}
