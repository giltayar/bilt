import debugMaker from 'debug'

const debug = debugMaker('bilt:packages-to-build:main')

import {
  createDependencyGraph,
  isEmptyGraph,
  buildLinkedDependencyGraphSubset,
  addPackagesThatAreDirty,
  addPackagesWhosDependenciesHaveLaterBuildTimes,
  addPackagesThatIndirectlyNeedToBeBuilt,
} from './dependency-graph.js'

/**
 * @typedef {import('./types').PackageInfoWithBuildTime} PackageInfoWithBuildTime
 * @typedef {import('./types').PackageInfosWithBuildTime} PackageInfosWithBuildTime
 */

/**
 * @typedef {'NO_LINKED_UPTO'} CalculatePackagesToBuildWarning
 */

/**
 *
 * @param {{
 *  packageInfos: PackageInfosWithBuildTime
 *  basePackagesToBuild: import('@bilt/types').Package[]
 *  buildUpTo: import('@bilt/types').Package[]
 * }} options
 * @returns {{
 *  packageInfosWithBuildTime: PackageInfosWithBuildTime
 *  warnings?: CalculatePackagesToBuildWarning[]
 * }}
 */
export function calculatePackagesToBuild({packageInfos, basePackagesToBuild, buildUpTo}) {
  debug('base packages:', basePackagesToBuild.map((p) => p.directory).join(' '))
  const {dependencyGraph, dependenciesSnipped} = createDependencyGraph(packageInfos)

  buildLinkedDependencyGraphSubset(dependencyGraph, basePackagesToBuild, buildUpTo)

  if (Object.keys(packageInfos).length > 0 && isEmptyGraph(dependencyGraph)) {
    return {packageInfosWithBuildTime: {}, warnings: ['NO_LINKED_UPTO']}
  }

  /**@type {Set<string>} */
  const packagesThatNeedToBeBuilt = new Set()

  addPackagesThatAreDirty(dependencyGraph, packageInfos, packagesThatNeedToBeBuilt)
  addPackagesWhosDependenciesHaveLaterBuildTimes(
    dependencyGraph,
    packageInfos,
    packagesThatNeedToBeBuilt,
  )

  addPackagesThatIndirectlyNeedToBeBuilt(dependencyGraph, packagesThatNeedToBeBuilt)

  return {
    packageInfosWithBuildTime: filterPackageInfos(
      packageInfos,
      packagesThatNeedToBeBuilt,
      dependenciesSnipped,
    ),
  }
}

/**
 * @param {PackageInfosWithBuildTime} packageInfos
 * @param {Set<string>} packagesThatNeedToBeBuilt
 * @param {[string, string][]} dependenciesSnipped
 */
function filterPackageInfos(packageInfos, packagesThatNeedToBeBuilt, dependenciesSnipped) {
  const filtered = Object.entries(packageInfos).filter(([pkgDirectory]) =>
    packagesThatNeedToBeBuilt.has(pkgDirectory),
  )

  if (dependenciesSnipped.length === 0) {
    return Object.fromEntries(filtered)
  } else {
    return Object.fromEntries(
      filtered.map(([pkgDirectory, packageInfo]) => [
        pkgDirectory,
        removeDepenedenciesSnipped(pkgDirectory, packageInfo, dependenciesSnipped),
      ]),
    )
  }
}

/**
 * @param {string} pkgDirectory
 * @param {import("./types").PackageInfoWithBuildTime} packageInfo
 * @param {[string, string][]} dependenciesSnipped
 */
function removeDepenedenciesSnipped(pkgDirectory, packageInfo, dependenciesSnipped) {
  if (!dependenciesSnipped.find(([pkgDirectory_]) => pkgDirectory_ === pkgDirectory)) {
    return packageInfo
  }
  return {
    ...packageInfo,
    dependencies: packageInfo.dependencies.filter(
      (d) =>
        !dependenciesSnipped.find(
          ([pkg, dependencyOfPkg]) =>
            pkg === packageInfo.directory && dependencyOfPkg === d.directory,
        ),
    ),
  }
}
