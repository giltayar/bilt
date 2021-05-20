import {promises as fs} from 'fs'
import makeFindArtifacts from '@bilt/artifact-finder'
import path from 'path'

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
 * @param {{rootDirectory: Directory}} options
 * @returns {Promise<Package[]>}
 */
export async function findNpmPackages({rootDirectory}) {
  const {findArtifacts} = await makeFindArtifacts()

  const result = /**@type {{path: RelativeDirectoryPath}[]}}*/ (await findArtifacts(rootDirectory))

  return result.map((artifact) => ({directory: artifact.path}))
}

/**
 *
 * @param {{rootDirectory: Directory, packages: Package[]}} options
 * @returns {Promise<PackageInfos>}
 */
export async function findNpmPackageInfos({rootDirectory, packages}) {
  const interimPackageInfos = await Promise.all(
    packages.map((pkg) => loadInterimPackageInfo(rootDirectory, pkg)),
  )

  const packageNameToPackagePath = Object.fromEntries(
    interimPackageInfos.map((interimPackageInfo) => [
      interimPackageInfo.name,
      interimPackageInfo.directory,
    ]),
  )

  return Object.fromEntries(
    interimPackageInfos.map((interimPackageInfo) => [
      interimPackageInfo.directory,
      interimPackageInfoToPackageInfo(interimPackageInfo, packageNameToPackagePath),
    ]),
  )
}

/**
 * @typedef {{
 *  directory: RelativeDirectoryPath
 *  name: string
 *  dependencies: string[]
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
  const dependenciesByName = [
    ...Object.keys(packageJson.dependencies || []),
    ...Object.keys(packageJson.devDependencies || []),
  ]

  return {
    ...pkg,
    name,
    dependencies: dependenciesByName,
  }
}

/**
 *
 * @param {InterimPackageInfo} interimPackageInfo
 * @param {{[packageName: string]: RelativeDirectoryPath}} packageNamesToPackagePaths
 * @returns {PackageInfo}
 */
function interimPackageInfoToPackageInfo(interimPackageInfo, packageNamesToPackagePaths) {
  return {
    directory: interimPackageInfo.directory,
    name: interimPackageInfo.name,
    dependencies: /**@type{Package[]}*/ (
      interimPackageInfo.dependencies
        .map((dep) =>
          packageNamesToPackagePaths[dep] != null
            ? {directory: /**@type {RelativeDirectoryPath}*/ (packageNamesToPackagePaths[dep])}
            : undefined,
        )
        .filter((dep) => dep !== undefined)
    ),
  }
}
