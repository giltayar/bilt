import {promises as fs} from 'fs'
import path from 'path'

/**
 * @typedef {import('@bilt/types').PackageInfos} PackageInfos
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('./types.js').BuildOrder} BuildOrder
 * @typedef {import('./types.js').BuildPackageResult} BuildPackageResult
 * @typedef {import('./types.js').BuildPackageFunction} BuildPackageFunction
 * @typedef {import('@bilt/types').RelativeDirectoryPath} RelativeDirectoryPath
 * @typedef {import('./types.js').BuildPackageSuccessResult} BuildPackageSuccessResult
 * @typedef {import('@bilt/types').Commitish} Commitish
 * @typedef {import('@bilt/types').Directory} Directory
 * @typedef {import('@bilt/types').LastSuccesfulBuildOfPackage} LastSuccessfulBuildOfPackage
 */

/**
 *
 * @param {{packageInfos: PackageInfos}} options
 * @returns {import('./types.js').BuildOrder}
 */
export function calculateBuildOrder({packageInfos}) {
  return calculateBuildOrderDo(packageInfos, new Map(), undefined)

  /**
   *
   * @param {PackageInfos} packageInfos
   * @param {import('./types.js').BuildsAlreadyAdded} buildsAlreadyAdded
   * @param {Package | undefined} rootPackage
   * @returns {BuildOrder}
   */
  function calculateBuildOrderDo(packageInfos, buildsAlreadyAdded, rootPackage) {
    const ret = /**@type {BuildOrder}*/ ([])

    const packagesToBuild = findPackagesWithDependenciesOnRoot(packageInfos, rootPackage)

    for (const packageToBuild of packagesToBuild) {
      const build = buildsAlreadyAdded.get(packageToBuild.directory) || {
        packageToBuild,
        buildOrderAfter: [],
      }

      buildsAlreadyAdded.set(packageToBuild.directory, build)
      ret.push(build)

      build.buildOrderAfter = calculateBuildOrderDo(
        packageInfos,
        buildsAlreadyAdded,
        packageToBuild,
      )
    }

    return ret
  }
}

/**
 * @param {PackageInfos} packageInfos
 * @param {BuildOrder} buildOrder
 * @param {BuildPackageFunction} buildPackageFunc
 * @returns {AsyncGenerator<BuildPackageResult>}
 */
export async function* build(packageInfos, buildOrder, buildPackageFunc) {
  /**@type {Set<RelativeDirectoryPath>} */
  const packagesThatCannotBeBuilt = new Set()

  yield* buildDo(buildOrder, new Set(), packagesThatCannotBeBuilt)

  for (const packageNotBuilt of packagesThatCannotBeBuilt) {
    yield {package: packageInfos[packageNotBuilt], buildResult: 'not-built'}
  }

  /**
   * @param {BuildOrder} buildOrder
   * @param {Set<RelativeDirectoryPath>} packagesAlreadyBuilt
   * @param {Set<RelativeDirectoryPath>} packagesThatCannotBeBuilt
   * @returns {AsyncGenerator<BuildPackageResult>}
   */
  async function* buildDo(buildOrder, packagesAlreadyBuilt, packagesThatCannotBeBuilt) {
    for (const build of buildOrder) {
      const packageDirectory = build.packageToBuild.directory
      if (packagesAlreadyBuilt.has(packageDirectory)) continue
      if (packagesThatCannotBeBuilt.has(packageDirectory)) continue

      const packageInfo = packageInfos[packageDirectory]
      if (
        packageInfo.dependencies
          .filter((dep) => dep.directory in packageInfos)
          .some((dep) => !packagesAlreadyBuilt.has(dep.directory))
      ) {
        continue
      }

      const [error, buildResult] = await presult(
        buildPackageFunc({
          packageInfo,
        }),
      )
      packagesAlreadyBuilt.add(packageDirectory)

      if (error || buildResult === 'failure') {
        yield {package: {directory: packageInfo.directory}, buildResult: 'failure', error}

        addSubTreeToPackagesThatCannotBeBuilt(
          build.buildOrderAfter,
          packagesThatCannotBeBuilt,
          packagesAlreadyBuilt,
        )
      } else {
        yield {
          package: {directory: packageInfo.directory},
          buildResult: /**@type {BuildPackageSuccessResult} */ (buildResult),
        }

        yield* buildDo(build.buildOrderAfter, packagesAlreadyBuilt, packagesThatCannotBeBuilt)
      }
    }
  }
}

/**
 *
 * @param {PackageInfos} packageInfos
 * @param {Package | undefined} rootPackage
 * @returns {Package[]}
 */
function findPackagesWithDependenciesOnRoot(packageInfos, rootPackage) {
  return Object.values(packageInfos).filter((packageInfo) =>
    rootPackage
      ? packageInfo.dependencies.length > 0 &&
        packageInfo.dependencies.some((dep) => dep.directory === rootPackage.directory)
      : packageInfo.dependencies.length === 0 ||
        packageInfo.dependencies.every((dep) => !(dep.directory in packageInfos)),
  )
}

/**
 * @template T
 * @template TErr
 * @param {Promise<T>} promise
 *
 * @returns {Promise<[err: TErr|undefined, value: T|undefined]>}
 */
export function presult(promise) {
  return promise.then(
    (v) => [undefined, v],
    (err) => [err, undefined],
  )
}

/**
 *
 * @param {BuildOrder} buildOrder
 * @param {Set<RelativeDirectoryPath>} packagesThatCannotBeBuilt
 * @param {Set<RelativeDirectoryPath>} packagesAlreadyBuilt
 */
function addSubTreeToPackagesThatCannotBeBuilt(
  buildOrder,
  packagesThatCannotBeBuilt,
  packagesAlreadyBuilt,
) {
  for (const build of buildOrder) {
    if (packagesAlreadyBuilt.has(build.packageToBuild.directory)) continue
    if (packagesThatCannotBeBuilt.has(build.packageToBuild.directory)) continue

    packagesThatCannotBeBuilt.add(build.packageToBuild.directory)

    addSubTreeToPackagesThatCannotBeBuilt(
      build.buildOrderAfter,
      packagesThatCannotBeBuilt,
      packagesAlreadyBuilt,
    )
  }
}
