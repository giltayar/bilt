import {promises as fs} from 'fs'
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
  return calculateBuildOrderDo(packageInfos, {})

  function calculateBuildOrderDo(
    packageInfos: PackageInfos,
    buildsAlreadyAdded: PackageBuildsAlreadyAdded,
  ): BuildOrder {
    const ret = [] as BuildOrder

    if (Object.keys(packageInfos).length === 0) return ret

    const packagesToBuild = findPackagesWithNoDependencies(packageInfos)

    for (const packageToBuild of packagesToBuild) {
      const build = buildsAlreadyAdded[packageToBuild.directory as string] || {
        packageToBuild,
        buildOrderAfter: calculateBuildOrderDo(
          filterOutPackageInfosAlreadyAdded(packageInfos, buildsAlreadyAdded),
          buildsAlreadyAdded,
        ),
        numberOfReferences: 0,
      }
      ++build.numberOfReferences
      ret.push(build)
    }

    return ret
  }
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

type PackageBuildsAlreadyAdded = {
  [packageDirectory: string]: Build
}

function findPackagesWithNoDependencies(packageInfos: PackageInfos): Package[] {
  return Object.values(packageInfos).filter(packageInfo => packageInfo.dependencies.length === 0)
}

function filterOutPackageInfosAlreadyAdded(
  packageInfos: PackageInfos,
  buildsAlreadyAdded: PackageBuildsAlreadyAdded,
): PackageInfos {
  return Object.fromEntries(
    Object.entries(packageInfos)
      .filter(([, packageInfo]) => (packageInfo.directory as string) in buildsAlreadyAdded)
      .map(([key, packageInfo]) => [
        key,
        removeDependenciesAlreadyAdded(packageInfo, buildsAlreadyAdded),
      ]),
  )
}

function removeDependenciesAlreadyAdded(
  packageInfo: PackageInfo,
  buildsAlreadyAdded: PackageBuildsAlreadyAdded,
): PackageInfo {
  return {
    ...packageInfo,
    dependencies: packageInfo.dependencies.filter(
      dep => (dep.directory as string) in buildsAlreadyAdded,
    ),
  }
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
