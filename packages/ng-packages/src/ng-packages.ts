import {promises as fs} from 'fs'
import makeFindArtifacts from '@bilt/artifact-finder'
import path from 'path'

export interface Directory extends String {}
export interface RelativeDirectoryPath extends String {}
export interface RelativeFilePath extends String {}
export interface Commitish extends String {}

export interface Package {
  directory: RelativeDirectoryPath
}

export interface PackageInfo extends Package {
  name: string
  dependencies: Package[]
}

export interface PackageInfos {
  [packageDirectory: string]: PackageInfo
}

export async function findNpmPackages({
  rootDirectory,
}: {
  rootDirectory: Directory
}): Promise<Package[]> {
  const {findArtifacts} = await makeFindArtifacts()

  const result = (await findArtifacts(rootDirectory)) as {path: string}[]

  return result.map(artifact => ({directory: artifact.path}))
}

export async function findNpmPackageInfos({
  rootDirectory,
  packages,
}: {
  rootDirectory: Directory
  packages: Package[]
}): Promise<PackageInfos> {
  const interimPackageInfos = await Promise.all(
    packages.map(pkg => loadInterimPackageInfo(rootDirectory, pkg)),
  )

  const packageNameToPackagePath = Object.fromEntries(
    interimPackageInfos.map(interimPackageInfo => [
      interimPackageInfo.name,
      interimPackageInfo.directory,
    ]),
  )

  return Object.fromEntries(
    interimPackageInfos.map(interimPackageInfo => [
      interimPackageInfo.directory,
      interimPackageInfoToPackageInfo(interimPackageInfo, packageNameToPackagePath),
    ]),
  )
}

type InterimPackageInfo = {
  directory: RelativeDirectoryPath
  name: string
  dependencies: string[]
}

async function loadInterimPackageInfo(
  rootDirectory: Directory,
  pkg: Package,
): Promise<InterimPackageInfo> {
  const packageJson = JSON.parse(
    await fs.readFile(
      path.join(rootDirectory as string, pkg.directory as string, 'package.json'),
      'utf-8',
    ),
  )
  const name = packageJson.name
  const dependenciesByName = [
    ...Object.keys(packageJson.dependencies || []),
    ...Object.keys(packageJson.devDependencies || []),
  ]

  return {
    ...pkg,
    name,
    dependencies: dependenciesByName,
  }
}

function interimPackageInfoToPackageInfo(
  interimPackageInfo: InterimPackageInfo,
  packageNamesToPackagePaths: {[packageName: string]: RelativeDirectoryPath},
): PackageInfo {
  return {
    directory: interimPackageInfo.directory,
    name: interimPackageInfo.name,
    dependencies: (interimPackageInfo.dependencies
      .map(dep =>
        packageNamesToPackagePaths[dep] != null
          ? {directory: packageNamesToPackagePaths[dep]}
          : undefined,
      )
      .filter(dep => dep !== undefined) as unknown) as PackageInfo[],
  }
}
