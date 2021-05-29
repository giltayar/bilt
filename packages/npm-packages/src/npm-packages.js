import {promises as fs} from 'fs'
import path from 'path'
import semver from 'semver'

/**
 * @typedef {import('@bilt/types').RelativeFilePath} RelativeFilePath
 * @typedef {import('@bilt/types').Commitish} Commitish
 * @typedef {import('@bilt/types').Directory} Directory
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('@bilt/types').PackageInfo} PackageInfo
 * @typedef {import('@bilt/types').PackageInfos} PackageInfos
 * @typedef {import('@bilt/types').RelativeDirectoryPath} RelativeDirectoryPath
 */

/**
 *
 * @param {{rootDirectory: Directory, packages: Package[]}} options
 * @returns {Promise<PackageInfos>}
 */
export async function findNpmPackageInfos({rootDirectory, packages}) {
  const interimPackageInfos = await Promise.all(
    packages.map((pkg) => loadInterimPackageInfo(rootDirectory, pkg)),
  )

  const packageNameToPackagePathAndDeps = Object.fromEntries(
    interimPackageInfos.map((interimPackageInfo) => [
      interimPackageInfo.name,
      {directory: interimPackageInfo.directory, version: interimPackageInfo.version},
    ]),
  )

  return Object.fromEntries(
    interimPackageInfos.map((interimPackageInfo) => [
      interimPackageInfo.directory,
      interimPackageInfoToPackageInfo(interimPackageInfo, packageNameToPackagePathAndDeps),
    ]),
  )
}

/**
 * @typedef {{
 *  directory: RelativeDirectoryPath
 *  name: string
 *  version: string | undefined
 *  dependencies: [name: string, semverRange: string][]
 * }} InterimPackageInfo
 * */

/**
 *
 * @param {Directory} rootDirectory
 * @param {Package} pkg
 * @returns {Promise<InterimPackageInfo>}
 */
async function loadInterimPackageInfo(rootDirectory, pkg) {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(rootDirectory, pkg.directory, 'package.json'), 'utf-8'),
  )
  const name = packageJson.name
  const version = packageJson.version
  const dependenciesByName = [
    ...Object.entries(packageJson.dependencies || []).map(
      ([k, v]) => /**@type {[string, string]}*/ ([k, semver.validRange(v)]),
    ),
    ...Object.entries(packageJson.devDependencies || []).map(
      ([k, v]) => /**@type {[string, string]}*/ ([k, semver.validRange(v)]),
    ),
  ]

  return {
    ...pkg,
    name,
    version,
    dependencies: dependenciesByName,
  }
}

/**
 *
 * @param {InterimPackageInfo} interimPackageInfo
 * @param {{[packageName: string]: {
 *  directory: RelativeDirectoryPath, version: string | undefined
 * }}} packageNamesToPackagePathsAndVersions
 * @returns {PackageInfo}
 */
function interimPackageInfoToPackageInfo(
  interimPackageInfo,
  packageNamesToPackagePathsAndVersions,
) {
  return {
    directory: interimPackageInfo.directory,
    name: interimPackageInfo.name,
    dependencies: /**@type{Package[]}*/ (
      interimPackageInfo.dependencies
        .map((dep) =>
          packageNamesToPackagePathsAndVersions[dep[0]] != null &&
          (!dep[1] ||
            !packageNamesToPackagePathsAndVersions[dep[0]].version ||
            semver.satisfies(packageNamesToPackagePathsAndVersions[dep[0]].version || '-', dep[1]))
            ? {
                directory: packageNamesToPackagePathsAndVersions[dep[0]].directory,
              }
            : undefined,
        )
        .filter((dep) => dep !== undefined)
    ),
  }
}
