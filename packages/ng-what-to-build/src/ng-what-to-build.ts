import {promisify} from 'util'
import {execFile} from 'child_process'
import {dependencyGraphSubsetToBuild, createDependencyGraph} from '@bilt/artifact-dependency-graph'
import {
  Package,
  Commitish,
  PackageInfos,
  RelativeFilePath,
  Directory,
  PackageInfo,
} from '@bilt/ng-packages'

export async function findChangedFiles({
  rootDirectory,
  fromCommit,
  toCommit,
}: {
  rootDirectory: Directory
  fromCommit: Commitish
  toCommit: Commitish
}): Promise<RelativeFilePath[]> {
  const diffTreeResult = await promisify(execFile)(
    'git',
    ['diff-tree', '--no-commit-id', '--name-only', '-r', fromCommit as string, toCommit as string],
    {
      cwd: rootDirectory as string,
    },
  )

  const changedFiles = diffTreeResult.stdout.split('\n').filter(l => !!l)

  return [...new Set(changedFiles)]
}

export function findChangedPackages({
  changedFiles,
  packages,
}: {
  changedFiles: RelativeFilePath[]
  packages: Package[]
}): Package[] {
  return packages.filter(pkg =>
    changedFiles.some(changedFile => changedFile.startsWith(pkg.directory + '/')),
  )
}

export function calculatePackagesToBuild({
  packageInfos,
  basePackagesToBuild,
  buildUpTo,
}: {
  packageInfos: PackageInfos
  basePackagesToBuild: Package[]
  buildUpTo: Package[]
}): PackageInfos {
  const dependencyGraph = createDependencyGraph(
    Object.values(packageInfos).map(packageInfoToArtifact),
  ) as DependencyGraphArtifacts

  const artifactsToBuild = dependencyGraphSubsetToBuild({
    dependencyGraph,
    changedArtifacts: packagesToArtifactNames(basePackagesToBuild, packageInfos),
    uptoArtifacts: packagesToArtifactNames(buildUpTo, packageInfos),
    fromArtifacts: [],
    justBuildArtifacts: [],
  }) as DependencyGraphArtifacts

  return artifactsToPackageInfos(artifactsToBuild, packageInfos)
}

function packageInfoToArtifact(packageInfo: PackageInfo) {
  return {
    name: packageInfo.directory as string,
    dependencies: packageInfo.dependencies.map(dep => dep.directory as string),
  }
}

function packageInfoToArtifactName(packageInfo: PackageInfo) {
  return packageInfo.directory as string
}

type DependencyGraphArtifacts = {[moduleName: string]: {dependencies: string[]}}

function packagesToArtifactNames(packages: Package[], packageInfos: PackageInfos): string[] {
  return packages.map(pkg => packageInfoToArtifactName(packageInfos[pkg.directory as string]))
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
