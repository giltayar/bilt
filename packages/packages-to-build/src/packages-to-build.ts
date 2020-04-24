import {Package} from '@bilt/types'

import {PackageInfoWithBuildTimes as PIWBT, PackageInfosWithBuildTimes as PIWBTs} from './types'
import {
  createDependencyGraph,
  buildLinkedDependencyGraphSubset,
  addPackagesThatAreDirty,
  addPackagesWhosDependenciesHaveLaterBuildTimes,
  addPackagesThatIndirectlyNeedToBeBuilt,
} from './dependency-graph'

export type PackageInfoWithBuildTimes = PIWBT
export type PackageInfosWithBuildTimes = PIWBTs

export function calculatePackagesToBuild({
  packageInfos,
  basePackagesToBuild,
  buildUpTo,
}: {
  packageInfos: PackageInfosWithBuildTimes
  basePackagesToBuild: Package[]
  buildUpTo: Package[]
}): PackageInfosWithBuildTimes {
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
  packageInfos: PackageInfosWithBuildTimes,
  packagesThatNeedToBeBuilt: Set<string>,
) {
  return Object.fromEntries(
    Object.entries(packageInfos).filter(([pkgDirectory]) =>
      packagesThatNeedToBeBuilt.has(pkgDirectory),
    ),
  )
}
