import gl, {Graph} from 'graphlib'
import {PackageInfosWithBuildTimes} from './types'
import {Package} from '@bilt/types'

export function createDependencyGraph(packageInfos: PackageInfosWithBuildTimes) {
  const graph = new gl.Graph()

  for (const [pkgId, pkgInfo] of Object.entries(packageInfos)) {
    for (const dependency of pkgInfo.dependencies) {
      graph.setEdge(pkgId, dependency.directory)
    }
  }

  return graph
}

export function buildLinkedDependencyGraphSubset(
  dependencyGraph: Graph,
  basePackagesToBuild: Package[],
  buildUpTo: Package[],
) {
  const packageDistances = gl.alg.dijkstraAll(dependencyGraph)

  for (const [pkg, distancesFromPkg] of Object.entries(packageDistances)) {
    if (
      connectsToFromNodes(distancesFromPkg, basePackagesToBuild) &&
      connectsFromToNodes(pkg, packageDistances, buildUpTo)
    ) {
      continue
    } else {
      dependencyGraph.removeNode(pkg)
    }
  }
}

export function addPackagesThatIndirectlyNeedToBeBuilt(
  dependencyGraph: Graph,
  packagesThatNeedToBeBuilt: Set<string>,
) {
  const packageDistances = gl.alg.dijkstraAll(dependencyGraph)

  for (const [pkg, distancesFromPkg] of Object.entries(packageDistances)) {
    for (const [connectedPkg, distance] of Object.entries(distancesFromPkg)) {
      if (distance.distance === Infinity) continue

      if (packagesThatNeedToBeBuilt.has(connectedPkg)) {
        packagesThatNeedToBeBuilt.add(pkg)
        break
      }
    }
  }
}

export function addPackagesThatAreDirty(
  dependencyGraph: Graph,
  packageInfos: PackageInfosWithBuildTimes,
  packagesThatNeedToBeBuilt: Set<string>,
) {
  for (const pkg of dependencyGraph.nodes()) {
    const packageInfo = packageInfos[pkg]
    if (packageInfo.lastBuildTime === undefined) {
      packagesThatNeedToBeBuilt.add(pkg)
    }
  }
}

export function addPackagesWhosDependenciesHaveLaterBuildTimes(
  dependencyGraph: Graph,
  packageInfos: PackageInfosWithBuildTimes,
  packagesThatNeedToBeBuilt: Set<string>,
) {
  for (const pkg of dependencyGraph.nodes()) {
    const packageInfo = packageInfos[pkg]
    if (packageInfo.lastBuildTime === undefined) continue

    for (const dependency of packageInfo.dependencies) {
      const depPackage = packageInfos[dependency.directory]
      if (!depPackage)
        throw new Error(
          `Package ${dependency} is a dependency of package ${pkg} but was not found in the list of packages`,
        )

      if (
        depPackage.lastBuildTime === undefined ||
        packageInfo.lastBuildTime < depPackage.lastBuildTime
      ) {
        packagesThatNeedToBeBuilt.add(pkg)
        break
      }
    }
  }
}

function connectsToFromNodes(
  distancesFromPkg: {[node: string]: gl.Path},
  basePackagesToBuild: Package[],
): boolean {
  return basePackagesToBuild.some((pkg) => distancesFromPkg[pkg.directory].distance !== Infinity)
}

function connectsFromToNodes(
  pkg: string,
  packageDistances: {[source: string]: {[node: string]: gl.Path}},
  buildUpTo: Package[],
) {
  return buildUpTo.some((toPkg) => packageDistances[toPkg.directory][pkg].distance !== Infinity)
}
