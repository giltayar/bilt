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
  RelativeDirectoryPath,
  LastSuccesfulBuildOfPackage,
} from '@bilt/ng-packages'

export type ChangedFilesInGit = Map<Commitish, RelativeFilePath[]>

export async function findChangedFiles({
  rootDirectory,
  fromGitDate = '1 year ago',
  toCommit = 'HEAD',
}: {
  fromGitDate?: string
  toCommit?: Commitish
  rootDirectory?: Directory
}): Promise<ChangedFilesInGit> {
  const COMMIT_PREFIX_IN_LOG = '----'
  const diffTreeResult = await promisify(execFile)(
    'git',
    [
      'log',
      `--format=format:${COMMIT_PREFIX_IN_LOG}%H`,
      '--name-only',
      `--since="${fromGitDate}"`,
      toCommit as string,
    ],
    {
      cwd: rootDirectory as string,
    },
  )
  const gitLogLines = diffTreeResult.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !!l)

  const ret = new Map<Commitish, RelativeFilePath[]>()

  for (const gitLogLine of gitLogLines) {
    var currentCommit //eslint-disable-line
    if (gitLogLine.startsWith(COMMIT_PREFIX_IN_LOG)) {
      currentCommit = gitLogLine.trim().slice(COMMIT_PREFIX_IN_LOG.length)
      ret.set(currentCommit, [])
    } else if (currentCommit) {
      ;(ret.get(currentCommit) as RelativeFilePath[]).push(gitLogLine)
    } else {
      throw new Error(`something is wrong here: ${gitLogLine}`)
    }
  }

  return ret
}

export function findChangedPackages({
  changedFilesInGit,
  lastSuccesfulBuildOfPackages,
}: {
  changedFilesInGit: ChangedFilesInGit
  lastSuccesfulBuildOfPackages: LastSuccesfulBuildOfPackage[]
}): Package[] {
  const packageChangeCounts = new Map<RelativeDirectoryPath, number>()
  const lastSuccesfulBuildCommitToPackages: Map<Commitish, Package[]> = makeCommitsToPackages(
    lastSuccesfulBuildOfPackages,
  )

  const packages = lastSuccesfulBuildOfPackages.map(({package: pkg}) => pkg)

  const packagesWhosLastSuccesfulBuildWasFound = new Set<RelativeDirectoryPath>()
  let packageWithSuccefulBuildWasFound = false
  for (const [commit, changedFiles] of [...changedFilesInGit.entries()].reverse()) {
    packageWithSuccefulBuildWasFound =
      packageWithSuccefulBuildWasFound || lastSuccesfulBuildCommitToPackages.has(commit)
    if (!packageWithSuccefulBuildWasFound) continue

    const packagesInCommit = packages.filter((pkg) =>
      changedFiles.some((changedFile) => changedFile.startsWith(pkg.directory + '/')),
    )
    const packagesThatWereLastSuccesfullyBuiltInThisCommit = lastSuccesfulBuildCommitToPackages.get(
      commit,
    )

    for (const packageInCommit of packagesInCommit) {
      if (packagesThatWereLastSuccesfullyBuiltInThisCommit?.includes(packageInCommit)) {
        packagesWhosLastSuccesfulBuildWasFound.add(packageInCommit.directory)
      }
      if (packagesWhosLastSuccesfulBuildWasFound.has(packageInCommit.directory))
        packageChangeCounts.set(
          packageInCommit.directory,
          (packageChangeCounts.get(packageInCommit.directory) || 0) + 1,
        )
    }
  }

  return [...packageChangeCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([packageDirectory]) => ({directory: packageDirectory}))
}

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

function makeCommitsToPackages(
  lastSuccesfulBuildOfPackages: LastSuccesfulBuildOfPackage[],
): Map<Commitish, Package[]> {
  const ret = new Map<Commitish, Package[]>()

  for (const {package: pkg, lastSuccesfulBuild: commit} of lastSuccesfulBuildOfPackages) {
    const packages = ret.get(commit)

    if (packages) {
      packages.push(pkg)
    } else {
      ret.set(commit, [pkg])
    }
  }

  return ret
}
