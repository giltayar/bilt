import {Package, Commitish, PackageInfos, PackageInfo, Directory} from './package-types'
import {BuildPackageSuccessResult, BuildPackageResult} from './build-types'

interface Build {
  packageToBuild: Package
  buildOrderAfter: BuildOrder
}

type BuildOrder = Build[]

export function filterPackageInfosByPackage({
  packageInfos,
  packages,
}: {
  packageInfos: PackageInfos
  packages: Package[]
}): PackageInfos {
  ;[packages, packageInfos, packages]

  throw new Error('Unimplemented')
}

export function calculateBuildOrder({packageInfos}: {packageInfos: PackageInfos}): BuildOrder {
  ;[packageInfos]

  throw new Error('Unimplemented')
}

type BuildPackageFunction = ({
  rootDirectory,
  packageInfo,
}: {
  rootDirectory: Directory
  packageInfo: PackageInfo
}) => Promise<BuildPackageSuccessResult>

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
