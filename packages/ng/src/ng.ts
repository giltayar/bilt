interface Directory extends String {}
interface RelativeDirectoryPath extends String {}
interface RelativeFilePath extends String {}
interface Commitish extends String {}

interface Package {
  package: RelativeDirectoryPath
}

interface PackageInfo extends Package {
  name: string
  dependencies: Package[]
}

interface PackageInfos {
  [packageDirectory: string]: PackageInfo
}

interface Build {
  packageToBuild: Package
  buildOrderAfter: BuildOrder
}

type BuildOrder = Build[]

export async function findNpmPackages({
  rootDirectory,
}: {
  rootDirectory: Directory
}): Promise<Package[]> {
  ;[rootDirectory]

  throw new Error('Unimplemented')
}

export async function findDependencies({packages}: {packages: Package[]}): Promise<PackageInfos> {
  ;[packages]

  throw new Error('Unimplemented')
}

export async function findChangedFiles({
  fromCommit,
  toCommit,
}: {
  fromCommit: Commitish
  toCommit: Commitish
}): Promise<RelativeFilePath[]> {
  ;[fromCommit, toCommit]

  throw new Error('Unimplemented')
}

export async function findChangedPackages({
  changedFiles,
  packages,
}: {
  changedFiles: RelativeFilePath[]
  packages: Package[]
}): Promise<Package[]> {
  ;[changedFiles, packages]

  throw new Error('Unimplemented')
}

export function calculatePackagesToBuild({
  packages,
  changedPackages,
  buildUpTo,
  shouldForceBuildAll,
}: {
  packages: PackageInfos
  changedPackages: Package[]
  buildUpTo: Package[]
  shouldForceBuildAll: boolean
}): Package[] {
  ;[packages, changedPackages, buildUpTo, shouldForceBuildAll]

  throw new Error('Unimplemented')
}

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

interface BuildPackageResult extends Boolean {}
type BuildPackageFunction = ({
  rootDirectory,
  packageInfo,
}: {
  rootDirectory: Directory
  packageInfo: PackageInfo
}) => Promise<BuildPackageResult>

export async function build({
  buildOrder,
  buildPackage,
}: {
  buildOrder: BuildOrder
  buildPackage: BuildPackageFunction
}): Promise<{package: PackageInfo; buildResult: 'success' | 'failure' | 'not-built'}[]> {
  ;[buildOrder, buildPackage]

  throw new Error('Unimplemented')
}
