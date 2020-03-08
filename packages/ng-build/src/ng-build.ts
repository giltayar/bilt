import {promises as fs} from 'fs'
import assert from 'assert'
import path from 'path'
import {
  Package,
  Commitish,
  PackageInfos,
  PackageInfo,
  Directory,
  RelativeDirectoryPath,
} from '@bilt/ng-packages'

export type BuildPackageSuccessResult = 'success' | 'failure'

export interface BuildPackageResult {
  package: Package
  buildResult: BuildPackageSuccessResult | 'not-built'
  error?: any
}

export interface Build {
  packageToBuild: Package
  buildOrderAfter: BuildOrder
  numberOfReferences: number
}

export type BuildOrder = Build[]

export type BuildPackageFunction = ({
  rootDirectory,
  packageInfo,
}: {
  rootDirectory: Directory
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
    addPackagesToBuildsAlreadyAdded(packagesToBuild, buildsAlreadyAdded)

    for (const packageToBuild of packagesToBuild) {
      const build = buildsAlreadyAdded.get(packageToBuild.directory)

      if (build) {
        ++build.numberOfReferences
        ret.push(build)
        if (build.numberOfReferences === 1) {
          build.buildOrderAfter = calculateBuildOrderDo(
            packageInfos,
            buildsAlreadyAdded,
            packageToBuild,
          )
        }
      } else {
        assert.fail('has to be not null')
      }
    }

    return ret
  }
}

function addPackagesToBuildsAlreadyAdded(
  packagesToBuild: Package[],
  buildsAlreadyAdded: BuildsAlreadyAdded,
) {
  packagesToBuild.forEach(packageToBuild => {
    if (!buildsAlreadyAdded.has(packageToBuild.directory)) {
      buildsAlreadyAdded.set(packageToBuild.directory, {
        packageToBuild,
        numberOfReferences: 0,
        buildOrderAfter: [],
      })
    }
  })
}

export async function* build({
  rootDirectory,
  buildOrder,
  buildPackage,
  packageInfos,
}: {
  rootDirectory: Directory
  buildOrder: BuildOrder
  buildPackage: BuildPackageFunction
  packageInfos: PackageInfos
}): AsyncGenerator<BuildPackageResult> {
  async function* buildDo(
    buildOrder: BuildOrder,
    packagesThatCannotBeBuilt: Set<RelativeDirectoryPath>,
  ): AsyncGenerator<BuildPackageResult> {
    for (const build of buildOrder) {
      const packageDirectory = build.packageToBuild.directory as string
      if (packagesThatCannotBeBuilt.has(packageDirectory)) continue
      if (--build.numberOfReferences > 0) continue

      const packageInfo = packageInfos[packageDirectory]
      const [error, buildResult] = await presult(
        buildPackage({
          rootDirectory,
          packageInfo,
        }),
      )

      if (error) {
        packagesThatCannotBeBuilt.add(packageDirectory)
        yield {package: packageInfo, buildResult: 'failure', error}

        addSubTreeToPackagesThatCannotBeBuilt(build.buildOrderAfter, packagesThatCannotBeBuilt)
      } else {
        yield {package: packageInfo, buildResult: buildResult as BuildPackageSuccessResult}

        yield* buildDo(build.buildOrderAfter, packagesThatCannotBeBuilt)
      }
    }
  }

  const packagesThatCannotBeBuilt = new Set<RelativeDirectoryPath>()

  yield* buildDo(buildOrder, packagesThatCannotBeBuilt)

  for (const packageThatWasNotBuilt of packagesThatCannotBeBuilt) {
    yield {package: packageInfos[packageThatWasNotBuilt as string], buildResult: 'not-built'}
  }
}

export async function saveBuildResults({
  rootDir,
  buildPackageResult,
  commit,
}: {
  rootDir: Directory
  buildPackageResult: BuildPackageResult
  commit: Commitish
}) {
  if (buildPackageResult.buildResult !== 'success') return

  const resultDirectory = path.join(
    rootDir as string,
    buildPackageResult.package.directory as string,
  )
  await fs.mkdir(resultDirectory, {
    recursive: true,
  })

  await fs.writeFile(
    path.join(resultDirectory, '.buildresult.json'),
    JSON.stringify({buildPackageResult, commit}),
  )
}

export async function loadBuildResults({
  rootDir,
  packages,
}: {
  rootDir: Directory
  packages: Package[]
}): Promise<(BuildPackageResult | undefined)[]> {
  return await Promise.all(
    packages.map(async pkg => {
      const resultDirectory = path.join(rootDir as string, pkg.directory as string)
      const [error, buildResultJsonString] = await presult(
        fs.readFile(path.join(resultDirectory, '.buildresult.json'), 'utf-8'),
      )

      if (error) {
        if (error.code === 'ENOENT') return undefined
        else throw error
      }

      return JSON.parse(buildResultJsonString as string).buildPackageResult as BuildPackageResult
    }),
  )
}

type BuildsAlreadyAdded = Map<RelativeDirectoryPath, Build>

function findPackagesWithDependenciesOnRoot(
  packageInfos: PackageInfos,
  rootPackage: Package | undefined,
): Package[] {
  return Object.values(packageInfos).filter(packageInfo =>
    rootPackage
      ? packageInfo.dependencies.length > 0 &&
        packageInfo.dependencies.some(dep => dep.directory === rootPackage.directory)
      : packageInfo.dependencies.length === 0,
  )
}

async function presult<T>(promise: Promise<T>): Promise<[any | undefined, T | undefined]> {
  return promise.then(
    v => [undefined, v],
    err => [err, undefined],
  )
}

function addSubTreeToPackagesThatCannotBeBuilt(
  buildOrder: BuildOrder,
  packagesThatCannotBeBuilt: Set<RelativeDirectoryPath>,
) {
  for (const build of buildOrder) {
    packagesThatCannotBeBuilt.add(build.packageToBuild.directory as string)

    addSubTreeToPackagesThatCannotBeBuilt(build.buildOrderAfter, packagesThatCannotBeBuilt)
  }
}
