import {promises as fs} from 'fs'
import {Directory, Package, PackageInfos, PackageInfo} from './package-types'
import makeFindArtifacts from '@bilt/artifact-finder'

export async function findNpmPackages({
  rootDirectory,
}: {
  rootDirectory: Directory
}): Promise<Package[]> {
  const {findArtifacts} = await makeFindArtifacts()

  const result = (await findArtifacts(rootDirectory)) as {path: string}[]

  return result.map(artifact => ({package: artifact.path}))
}

export async function findNpmPackageInfos({
  packages,
}: {
  packages: Package[]
}): Promise<PackageInfos> {
  const packageInfosAsArray: PackageInfo[] = await Promise.all(
    packages.map(pkg => packageToPackageInfo(pkg, packages)),
  )

  return Object.fromEntries(
    packageInfosAsArray.map(packageInfo => [packageInfo.package, packageInfo]),
  )
}

async function packageToPackageInfo(
  pkg: Package,
  packageInfos: PackageInfos,
): Promise<PackageInfo> {
  const packageInfosByName = packageInfosToPackageInfosByName(packageInfos)

  const packageJson = JSON.parse(await fs.readFile(pkg.package as string, 'utf-8'))
  const name = packageJson.name
  const dependencies = [
    ...Object.keys(packageJson.dependencies || []),
    ...Object.keys(packageJson.devDependencies || []),
  ]

  return {
    ...pkg,
    name,
    dependencies: dependencies.map(dependency => packageInfosByName[dependency]),
  }
}

function packageInfosToPackageInfosByName(
  packageInfos: PackageInfos,
): {[name: string]: PackageInfo} {
  return Object.fromEntries(
    Object.values(packageInfos).map(packageInfo => [packageInfo.name, packageInfo]),
  )
}
