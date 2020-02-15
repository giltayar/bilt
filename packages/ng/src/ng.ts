import {Package, Commitish, PackageInfos, PackageInfo, Directory} from './package-types'
import {BuildPackageSuccessResult, BuildPackageResult} from './build-types'

export {calculatePackagesToBuild, findChangedFiles, findChangedPackages} from './what-to-build'
export {findNpmPackageInfos, findNpmPackages} from './npm-packages'

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
      const build = buildsAlreadyAdded[packageToBuild.package as string] || {
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
  buildOrder,
  buildPackage,
}: {
  buildOrder: BuildOrder
  buildPackage: BuildPackageFunction
}): AsyncGenerator<BuildPackageResult> {
  ;[buildOrder, buildPackage]

  throw new Error('Unimplemented')
}

export async function saveBuildResults({
  rootDir,
  buildPackageResult,
  commit,
}: {
  rootDir: Directory
  buildPackageResult: BuildPackageResult
  commit: Commitish
}): Promise<undefined> {
  ;[rootDir, buildPackageResult, commit]

  throw new Error('Unimplemented')
}

export async function loadBuildResults({
  rootDir,
  packages,
}: {
  rootDir: Directory
  packages: Package[]
}): Promise<BuildPackageResult[]> {
  ;[rootDir, packages]

  throw new Error('Unimplemented')
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
      .filter(([, packageInfo]) => (packageInfo.package as string) in buildsAlreadyAdded)
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
      dep => (dep.package as string) in buildsAlreadyAdded,
    ),
  }
}
