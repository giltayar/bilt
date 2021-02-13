import debugMaker from 'debug'
import gl from 'graphlib'
const {alg} = gl

const debug = debugMaker('bilt:packages-to-build:dependency-graph')

/**
 * @typedef {import('./types').PackageInfosWithBuildTime} PackageInfosWithBuildTime
 * @typedef {import('@bilt/types').Package} Package
 */

/**
 *
 * @param {PackageInfosWithBuildTime} packageInfos
 * @returns {gl.Graph}
 */
export function createDependencyGraph(packageInfos) {
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

/**
 * @param {gl.Graph} dependencyGraph
 * @returns {boolean}
 */
export function isEmptyGraph(dependencyGraph) {
  return dependencyGraph.nodeCount() === 0
}

/**
 * @param {gl.Graph} dependencyGraph
 * @param {Package[]} basePackagesToBuild
 * @param {Package[]} buildUpTo
 */
export function buildLinkedDependencyGraphSubset(dependencyGraph, basePackagesToBuild, buildUpTo) {
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

/**
 * @param {gl.Graph} dependencyGraph
 * @param {Set<string>} packagesThatNeedToBeBuilt
 */
export function addPackagesThatIndirectlyNeedToBeBuilt(dependencyGraph, packagesThatNeedToBeBuilt) {
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

/**
 * @param {gl.Graph} dependencyGraph
 * @param {PackageInfosWithBuildTime} packageInfos
 * @param {Set<string>} packagesThatNeedToBeBuilt
 */
export function addPackagesThatAreDirty(dependencyGraph, packageInfos, packagesThatNeedToBeBuilt) {
  for (const pkg of dependencyGraph.nodes()) {
    const packageInfo = packageInfos[pkg]
    if (packageInfo.lastBuildTime === undefined) {
      debug('adding package', pkg, 'because has uncommited changes or last commit was not a build')

      packagesThatNeedToBeBuilt.add(pkg)
    }
  }
}

/**
 * @param {gl.Graph} dependencyGraph
 * @param {PackageInfosWithBuildTime} packageInfos
 * @param {Set<string>} packagesThatNeedToBeBuilt
 */
export function addPackagesWhosDependenciesHaveLaterBuildTimes(
  dependencyGraph,
  packageInfos,
  packagesThatNeedToBeBuilt,
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

/**
 * @param {{[node: string]: gl.Path}} distancesFromPkg
 * @param {Package[]} basePackagesToBuild
 */
function connectsToFromNodes(distancesFromPkg, basePackagesToBuild) {
  return basePackagesToBuild.some((pkg) => distancesFromPkg[pkg.directory].distance !== Infinity)
}

/**
 *
 * @param {string} pkg
 * @param {{[source: string]: {[node: string]: gl.Path}}} packageDistances
 * @param {Package[]} buildUpTo
 */
function connectsFromToNodes(pkg, packageDistances, buildUpTo) {
  return buildUpTo.some((toPkg) => packageDistances[toPkg.directory][pkg].distance !== Infinity)
}

/**
 * @param {gl.Graph} graph
 * @param {string[][]} cycles
 */
function snipCycles(graph, cycles) {
  debug('dependency graph has cycles:', cycles)

  for (const cycle of cycles) {
    debug('removing dependency between', cycle[1], 'and', cycle[0])
    graph.removeEdge(cycle[1], cycle[0])
  }
}
