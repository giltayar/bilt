import {promises as fs} from 'fs'
import {Directory, Package, PackageInfos, PackageInfo, RelativeDirectoryPath} from './package-types'
import makeFindArtifacts from '@bilt/artifact-finder'

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
  packages,
}: {
  packages: Package[]
}): Promise<PackageInfos> {
  const interimPackageInfos = await Promise.all(packages.map(pkg => loadInterimPackageInfo(pkg)))

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

async function loadInterimPackageInfo(pkg: Package): Promise<InterimPackageInfo> {
  const packageJson = JSON.parse(await fs.readFile(pkg.directory as string, 'utf-8'))
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
        packageNamesToPackagePaths[dep] == null
          ? {package: packageNamesToPackagePaths[dep]}
          : undefined,
      )
      .filter(dep => dep !== undefined) as unknown) as PackageInfo[],
  }
}
