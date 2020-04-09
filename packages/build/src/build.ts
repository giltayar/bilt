import {promises as fs} from 'fs'
import path from 'path'
import {
  Package,
  Commitish,
  PackageInfos,
  PackageInfo,
  Directory,
  RelativeDirectoryPath,
  LastSuccesfulBuildOfPackage,
} from '@bilt/types'

export type BuildPackageSuccessResult = 'success' | 'failure'

export interface BuildPackageResult {
  package: Package
  buildResult: BuildPackageSuccessResult | 'not-built'
  error?: any
}

export interface Build {
  packageToBuild: Package
  buildOrderAfter: BuildOrder
}

export type BuildOrder = Build[]

export type BuildPackageFunction = ({
  packageInfo,
}: {
  packageInfo: PackageInfo
}) => Promise<BuildPackageSuccessResult>

export function calculateBuildOrder({packageInfos}: {packageInfos: PackageInfos}): BuildOrder {
  return calculateBuildOrderDo(packageInfos, new Map<RelativeDirectoryPath, Build>(), undefined)

  function calculateBuildOrderDo(
    packageInfos: PackageInfos,
    buildsAlreadyAdded: BuildsAlreadyAdded,
    rootPackage: Package | undefined,
  ): BuildOrder {
    const ret = [] as BuildOrder

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

export async function* build({
  packageInfos,
  buildOrder,
  buildPackageFunc,
}: {
  packageInfos: PackageInfos
  buildOrder: BuildOrder
  buildPackageFunc: BuildPackageFunction
}): AsyncGenerator<BuildPackageResult> {
  const packagesThatCannotBeBuilt = new Set<RelativeDirectoryPath>()

  yield* buildDo(buildOrder, new Set<RelativeDirectoryPath>(), packagesThatCannotBeBuilt)

  for (const packageNotBuilt of packagesThatCannotBeBuilt) {
    yield {package: packageInfos[packageNotBuilt as string], buildResult: 'not-built'}
  }

  async function* buildDo(
    buildOrder: BuildOrder,
    packagesAlreadyBuilt: Set<RelativeDirectoryPath>,
    packagesThatCannotBeBuilt: Set<RelativeDirectoryPath>,
  ): AsyncGenerator<BuildPackageResult> {
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
          buildResult: buildResult as BuildPackageSuccessResult,
        }

        yield* buildDo(build.buildOrderAfter, packagesAlreadyBuilt, packagesThatCannotBeBuilt)
      }
    }
  }
}

export async function saveCommitOfLastSuccesfulBuild({
  rootDirectory,
  buildPackageResult,
  commit,
}: {
  rootDirectory: Directory
  buildPackageResult: BuildPackageResult
  commit: Commitish
}) {
  if (buildPackageResult.buildResult !== 'success') return

  const resultDirectory = path.join(
    rootDirectory as string,
    buildPackageResult.package.directory as string,
  )
  await fs.mkdir(resultDirectory, {
    recursive: true,
  })

  await fs.writeFile(
    path.join(resultDirectory, '.lastsuccesfulbuild.json'),
    JSON.stringify({commit}),
  )
}

export async function loadCommitsOfLastSuccesfulBuilds({
  rootDirectory,
  packages,
}: {
  rootDirectory: Directory
  packages: Package[]
}): Promise<LastSuccesfulBuildOfPackage[]> {
  return (
    await Promise.all(
      packages.map(async (pkg) => {
        const resultDirectory = path.join(rootDirectory as string, pkg.directory as string)
        const [error, buildResultJsonString] = await presult(
          fs.readFile(path.join(resultDirectory, '.lastsuccesfulbuild.json'), 'utf-8'),
        )

        if (error) {
          if (error.code === 'ENOENT') return undefined
          else throw error
        }

        const result = JSON.parse(buildResultJsonString as string) as {
          commit: Commitish
        }

        return {package: pkg, lastSuccesfulBuild: result.commit}
      }),
    )
  ).filter((lsbop) => !!lsbop) as LastSuccesfulBuildOfPackage[]
}

type BuildsAlreadyAdded = Map<RelativeDirectoryPath, Build>

function findPackagesWithDependenciesOnRoot(
  packageInfos: PackageInfos,
  rootPackage: Package | undefined,
): Package[] {
  return Object.values(packageInfos).filter((packageInfo) =>
    rootPackage
      ? packageInfo.dependencies.length > 0 &&
        packageInfo.dependencies.some((dep) => dep.directory === rootPackage.directory)
      : packageInfo.dependencies.length === 0 ||
        packageInfo.dependencies.every((dep) => !(dep.directory in packageInfos)),
  )
}

async function presult<T>(promise: Promise<T>): Promise<[any | undefined, T | undefined]> {
  return promise.then(
    (v) => [undefined, v],
    (err) => [err, undefined],
  )
}

function addSubTreeToPackagesThatCannotBeBuilt(
  buildOrder: BuildOrder,
  packagesThatCannotBeBuilt: Set<RelativeDirectoryPath>,
  packagesAlreadyBuilt: Set<RelativeDirectoryPath>,
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
