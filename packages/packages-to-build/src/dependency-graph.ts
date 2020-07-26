import debugMaker from 'debug'
import gl, {Graph, alg} from 'graphlib'
import {PackageInfosWithBuildTime} from './types'
import {Package} from '@bilt/types'

const debug = debugMaker('bilt:packages-to-build:dependency-graph')

export function createDependencyGraph(packageInfos: PackageInfosWithBuildTime): gl.Graph {
  const graph = new gl.Graph()

  for (const [pkgId, pkgInfo] of Object.entries(packageInfos)) {
    graph.setNode(pkgId)
    for (const dependency of pkgInfo.dependencies) {
      graph.setEdge(pkgId, dependency.directory)
    }
  }

  const cycles = alg.findCycles(graph)

  if (cycles && cycles.length > 0) {
    snipCycles(graph, cycles)
  }

  return graph
}

export function isEmptyGraph(dependencyGraph: Graph): boolean {
  return dependencyGraph.nodeCount() === 0
}

export function buildLinkedDependencyGraphSubset(
  dependencyGraph: Graph,
  basePackagesToBuild: Package[],
  buildUpTo: Package[],
): void {
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
): void {
  const packageDistances = gl.alg.dijkstraAll(dependencyGraph)

  for (const [pkg, distancesFromPkg] of Object.entries(packageDistances)) {
    for (const [connectedPkg, distance] of Object.entries(distancesFromPkg)) {
      if (distance.distance === Infinity) continue

      if (packagesThatNeedToBeBuilt.has(connectedPkg) && connectedPkg !== pkg) {
        debug('adding package', pkg, 'because', connectedPkg, 'is a(n) (in)direct dependency of it')
        packagesThatNeedToBeBuilt.add(pkg)
        break
      }
    }
  }
}

export function addPackagesThatAreDirty(
  dependencyGraph: Graph,
  packageInfos: PackageInfosWithBuildTime,
  packagesThatNeedToBeBuilt: Set<string>,
): void {
  for (const pkg of dependencyGraph.nodes()) {
    const packageInfo = packageInfos[pkg]
    if (packageInfo.lastBuildTime === undefined) {
      debug('adding package', pkg, 'because has uncommited changes or last commit was not a build')

      packagesThatNeedToBeBuilt.add(pkg)
    }
  }
}

export function addPackagesWhosDependenciesHaveLaterBuildTimes(
  dependencyGraph: Graph,
  packageInfos: PackageInfosWithBuildTime,
  packagesThatNeedToBeBuilt: Set<string>,
): void {
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
        debug(
          'adding package',
          pkg,
          'because',
          depPackage,
          ', who it depends on, has a later build',
        )
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

function snipCycles(graph: gl.Graph, cycles: string[][]) {
  debug('dependency graph has cycles:', cycles)

  for (const cycle of cycles) {
    debug('removing dependency between', cycle[1], 'and', cycle[0])
    graph.removeEdge(cycle[1], cycle[0])
  }
}
