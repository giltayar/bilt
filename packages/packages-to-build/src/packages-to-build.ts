import debugMaker from 'debug'
import {Package} from '@bilt/types'

const debug = debugMaker('bilt:packages-to-build:main')

import {PackageInfoWithBuildTime as PIWBT, PackageInfosWithBuildTime as PIWBTs} from './types'
import {
  createDependencyGraph,
  isEmptyGraph,
  buildLinkedDependencyGraphSubset,
  addPackagesThatAreDirty,
  addPackagesWhosDependenciesHaveLaterBuildTimes,
  addPackagesThatIndirectlyNeedToBeBuilt,
} from './dependency-graph'

export type PackageInfoWithBuildTime = PIWBT
export type PackageInfosWithBuildTime = PIWBTs

type CalculatePackagesToBuildWarning = 'NO_LINKED_UPTO'

export function calculatePackagesToBuild({
  packageInfos,
  basePackagesToBuild,
  buildUpTo,
}: {
  packageInfos: PackageInfosWithBuildTime
  basePackagesToBuild: Package[]
  buildUpTo: Package[]
}): {
  packageInfosWithBuildTime: PackageInfosWithBuildTime
  warnings?: CalculatePackagesToBuildWarning[]
} {
  debug('base packages:', basePackagesToBuild.map((p) => p.directory).join(' '))
  const dependencyGraph = createDependencyGraph(packageInfos)

  buildLinkedDependencyGraphSubset(dependencyGraph, basePackagesToBuild, buildUpTo)

  if (Object.keys(packageInfos).length > 0 && isEmptyGraph(dependencyGraph)) {
    return {packageInfosWithBuildTime: {}, warnings: ['NO_LINKED_UPTO']}
  }

  const packagesThatNeedToBeBuilt = new Set<string>()

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

function filterPackageInfos(
  packageInfos: PackageInfosWithBuildTime,
  packagesThatNeedToBeBuilt: Set<string>,
) {
  return Object.fromEntries(
    Object.entries(packageInfos).filter(([pkgDirectory]) =>
      packagesThatNeedToBeBuilt.has(pkgDirectory),
    ),
  )
}
