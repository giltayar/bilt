import {Package} from '@bilt/types'

import {PackageInfoWithBuildTime as PIWBT, PackageInfosWithBuildTime as PIWBTs} from './types'
import {
  createDependencyGraph,
  buildLinkedDependencyGraphSubset,
  addPackagesThatAreDirty,
  addPackagesWhosDependenciesHaveLaterBuildTimes,
  addPackagesThatIndirectlyNeedToBeBuilt,
} from './dependency-graph'

export type PackageInfoWithBuildTime = PIWBT
export type PackageInfosWithBuildTime = PIWBTs

export function calculatePackagesToBuild({
  packageInfos,
  basePackagesToBuild,
  buildUpTo,
}: {
  packageInfos: PackageInfosWithBuildTime
  basePackagesToBuild: Package[]
  buildUpTo: Package[]
}): PackageInfosWithBuildTime {
  const dependencyGraph = createDependencyGraph(packageInfos)

  buildLinkedDependencyGraphSubset(dependencyGraph, basePackagesToBuild, buildUpTo)

  const packagesThatNeedToBeBuilt = new Set<string>()

  addPackagesThatAreDirty(dependencyGraph, packageInfos, packagesThatNeedToBeBuilt)
  addPackagesWhosDependenciesHaveLaterBuildTimes(
    dependencyGraph,
    packageInfos,
    packagesThatNeedToBeBuilt,
  )

  addPackagesThatIndirectlyNeedToBeBuilt(dependencyGraph, packagesThatNeedToBeBuilt)

  return filterPackageInfos(packageInfos, packagesThatNeedToBeBuilt)
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
