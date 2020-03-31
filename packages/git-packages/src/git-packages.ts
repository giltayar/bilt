import {promisify} from 'util'
import {execFile} from 'child_process'
import {
  Package,
  Commitish,
  RelativeFilePath,
  Directory,
  RelativeDirectoryPath,
  LastSuccesfulBuildOfPackage,
} from '@bilt/types'

export type ChangedFilesInGit = Map<Commitish, RelativeFilePath[]>

export async function findChangedFiles({
  rootDirectory,
  fromGitDate = '1 year ago',
  toCommit = 'HEAD' as Commitish,
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
      currentCommit = gitLogLine.trim().slice(COMMIT_PREFIX_IN_LOG.length) as Commitish
      ret.set(currentCommit, [])
    } else if (currentCommit) {
      ret.get(currentCommit)?.push(gitLogLine as RelativeFilePath)
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
