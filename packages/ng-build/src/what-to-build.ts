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
import {BuildPackageResult} from './build-types'

export async function findChangedFiles({
  rootDir,
  fromCommit,
  toCommit,
}: {
  rootDir: Directory
  fromCommit: Commitish
  toCommit: Commitish
}): Promise<RelativeFilePath[]> {
  const diffTreeResult = await promisify(execFile)(
    'git',
    ['diff-tree', '--no-commit-id', '--name-only', '-r', fromCommit as string, toCommit as string],
    {
      cwd: rootDir as string,
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
  return packages.filter(pkg => changedFiles.some(changedFile => changedFile.startsWith(pkg + '/')))
}

export function calculatePackagesToBuild({
  packageInfos,
  changedPackages,
  buildResults,
  buildUpTo,
  shouldForceBuildAll,
}: {
  packageInfos: PackageInfos
  changedPackages: Package[]
  buildResults: BuildPackageResult[]
  buildUpTo: Package[]
  shouldForceBuildAll: boolean
}): PackageInfos {
  if (shouldForceBuildAll) {
    return packageInfos
  }

  const dependencyGraph = createDependencyGraph(
    Object.values(packageInfos).map(packageInfoToArtifact),
  )

  const changedAndFailedPackages = changedPackages.concat(
    buildResults
      .filter(buildResult => buildResult.buildResult === 'failure')
      .map(buildResult => buildResult.package),
  )

  const artifactsToBuild = dependencyGraphSubsetToBuild({
    dependencyGraph,
    changedArtifacts: packagesToArtifacts(changedAndFailedPackages, packageInfos),
    uptoArtifacts: packagesToArtifacts(buildUpTo, packageInfos),
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

type DependencyGraphArtifacts = {
  name: string
  dependencies: string[]
}[]

function packagesToArtifacts(
  packages: Package[],
  packageInfos: PackageInfos,
): DependencyGraphArtifacts {
  return packages.map(pkg => packageInfoToArtifact(packageInfos[pkg.directory as string]))
}

function artifactsToPackageInfos(
  artifactsToBuild: DependencyGraphArtifacts,
  packageInfos: PackageInfos,
) {
  const ret: PackageInfos = {}

  for (const artifactToBuild of artifactsToBuild) {
    ret[artifactToBuild.name] = packageInfos[artifactToBuild.name]
  }

  return ret
}
