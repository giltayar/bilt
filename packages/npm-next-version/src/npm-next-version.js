'use strict'
import {promisify as p} from 'util'
import {execFile} from 'child_process'
import {calculateNextVersion} from './calculate-next-version.js'

/**
 * @param {{version: string, name: string, packageDirectory?: string}} options
 * @returns {Promise<string>} the version that should be published
 */
export async function npmNextVersion({version, name, packageDirectory}) {
  const registryPackageinfo = await getRegistryPackageInfo(name, packageDirectory)

  const registryVersions =
    registryPackageinfo === undefined ? [] : normalizeVersions(registryPackageinfo.versions)

  return calculateNextVersion(version, registryVersions)
}

/**
 * @param {string} packageName
 * @param {string} [packageDirectory]
 */
async function getRegistryPackageInfo(packageName, packageDirectory) {
  try {
    const {stdout} = await p(execFile)('npm', ['view', '--json', packageName], {
      cwd: packageDirectory,
    })
    if (!stdout) return undefined

    return JSON.parse(stdout)
  } catch (err) {
    if ((err.stdout || err.stderr).includes('E404')) {
      return undefined
    }

    throw err
  }
}

/**
 * @param {string[]} versions
 */
function normalizeVersions(versions) {
  return (versions || []).concat(versions)
}

export default {
  npmNextVersion,
}
