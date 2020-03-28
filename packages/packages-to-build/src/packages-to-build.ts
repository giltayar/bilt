import {Package, PackageInfos, PackageInfo} from '@bilt/types'
import {dependencyGraphSubsetToBuild, createDependencyGraph} from '@bilt/artifact-dependency-graph'

export function calculatePackagesToBuild({
  packageInfos,
  basePackagesToBuild,
  buildUpTo,
}: {
  packageInfos: PackageInfos
  basePackagesToBuild: Package[]
  buildUpTo: Package[] | undefined
}): PackageInfos {
  const dependencyGraph = createDependencyGraph(
    Object.values(packageInfos).map(packageInfoToArtifact),
  ) as DependencyGraphArtifacts

  const changedArtifacts = packagesToArtifactNames(basePackagesToBuild, packageInfos)
  const artifactsToBuild = dependencyGraphSubsetToBuild({
    dependencyGraph,
    changedArtifacts: changedArtifacts,
    uptoArtifacts: buildUpTo ? packagesToArtifactNames(buildUpTo, packageInfos) : [],
    fromArtifacts: undefined,
    justBuildArtifacts: buildUpTo == null ? changedArtifacts : undefined,
  }) as DependencyGraphArtifacts

  return artifactsToPackageInfos(artifactsToBuild, packageInfos)
}

function packageInfoToArtifact(packageInfo: PackageInfo) {
  return {
    name: packageInfo.directory as string,
    dependencies: packageInfo.dependencies.map((dep) => dep.directory as string),
  }
}

function packageInfoToArtifactName(packageInfo: PackageInfo) {
  return packageInfo.directory as string
}

type DependencyGraphArtifacts = {[moduleName: string]: {dependencies: string[]}}

function packagesToArtifactNames(packages: Package[], packageInfos: PackageInfos): string[] {
  return packages.map((pkg) => packageInfoToArtifactName(packageInfos[pkg.directory as string]))
}

function artifactsToPackageInfos(
  artifactsToBuild: DependencyGraphArtifacts,
  packageInfos: PackageInfos,
) {
  const ret: PackageInfos = {}

  for (const name of Object.keys(artifactsToBuild)) {
    ret[name] = packageInfos[name]
  }

  return ret
}
