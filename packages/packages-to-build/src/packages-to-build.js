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
  const dependencyGraph = createDependencyGraph(packageInfos)

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
    packageInfosWithBuildTime: filterPackageInfos(packageInfos, packagesThatNeedToBeBuilt),
  }
}

/**
 *
 * @param {PackageInfosWithBuildTime} packageInfos
 * @param {Set<string>} packagesThatNeedToBeBuilt
 */
function filterPackageInfos(packageInfos, packagesThatNeedToBeBuilt) {
  return Object.fromEntries(
    Object.entries(packageInfos).filter(([pkgDirectory]) =>
      packagesThatNeedToBeBuilt.has(pkgDirectory),
    ),
  )
}
