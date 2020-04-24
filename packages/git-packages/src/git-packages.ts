import {promisify} from 'util'
import {execFile} from 'child_process'
import {Package, Commitish, RelativeFilePath, Directory, RelativeDirectoryPath} from '@bilt/types'

export type CommitInfo = {commitTime: Date; files: RelativeFilePath[]}

export type ChangedFilesInGit = Map<Commitish, CommitInfo>

export const FAKE_COMMITISH_FOR_UNCOMMITED_FILES = '' as Commitish
const COMMIT_PREFIX_IN_LOG = '----'

export async function findChangedFiles({
  rootDirectory,
  fromGitDate = '1 year ago',
  toCommit = 'HEAD' as Commitish,
  includeWorkspaceFiles = true,
}: {
  fromGitDate?: string
  toCommit?: Commitish
  rootDirectory?: Directory
  includeWorkspaceFiles?: boolean
}): Promise<ChangedFilesInGit> {
  const [diffTreeResult, statusResult, lsFilesResult] = await Promise.all([
    promisify(execFile)(
      'git',
      [
        'log',
        `--format=format:${COMMIT_PREFIX_IN_LOG}%cd$%H`,
        '--date=iso',
        '--name-only',
        `--since="${fromGitDate}"`,
        toCommit as string,
      ],
      {
        cwd: rootDirectory as string,
        maxBuffer: 1024 * 1024 * 1024,
      },
    ),
    promisify(execFile)('git', ['status', `--porcelain`, '--no-renames'], {
      cwd: rootDirectory as string,
      maxBuffer: 1024 * 1024 * 1024,
    }),
    promisify(execFile)('git', ['ls-files', `--others`, '--exclude-standard'], {
      cwd: rootDirectory as string,
      maxBuffer: 1024 * 1024 * 1024,
    }),
  ])

  const ret = new Map<Commitish, CommitInfo>()

  if (includeWorkspaceFiles) {
    addChangedFilesFromGitStatus(ret, statusResult)
    addUntrackedFiles(ret, lsFilesResult)
  }
  addChangedFilesFromDiffTree(ret, diffTreeResult)

  return ret
}

export type PackageChange = {
  package: Package
  commit: Commitish
  commitTime: Date
}

export function findLatestPackageChanges({
  changedFilesInGit,
  packages,
}: {
  changedFilesInGit: ChangedFilesInGit
  packages: Package[]
}): PackageChange[] {
  const lastCommitOfPackages = new Map<RelativeDirectoryPath, [Commitish, CommitInfo]>()

  for (const [commit, commitInfo] of [...changedFilesInGit.entries()]) {
    const packagesInCommit = packages.filter((pkg) =>
      commitInfo.files.some((changedFile) => changedFile.startsWith(pkg.directory + '/')),
    )
    for (const packageInCommit of packagesInCommit) {
      if (!lastCommitOfPackages.has(packageInCommit.directory))
        lastCommitOfPackages.set(packageInCommit.directory, [commit, commitInfo])
    }
    if (lastCommitOfPackages.size === packages.length) {
      break
    }
  }
  return [...lastCommitOfPackages.entries()].map(([packageDirectory, [commit, commitInfo]]) => ({
    package: {directory: packageDirectory},
    commit,
    commitTime: commitInfo.commitTime,
  }))
}

function addChangedFilesFromDiffTree(
  changedFiles: ChangedFilesInGit,
  diffTreeResult: {stdout: string},
) {
  const gitDiffTreeLogLines = diffTreeResult.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !!l)
  let currentCommit
  for (const gitLogLine of gitDiffTreeLogLines) {
    if (gitLogLine.startsWith(COMMIT_PREFIX_IN_LOG)) {
      const currentCommitWithTime = gitLogLine.trim().slice(COMMIT_PREFIX_IN_LOG.length).split('$')
      const commitTime = new Date(currentCommitWithTime[0])
      currentCommit = currentCommitWithTime[1] as Commitish

      changedFiles.set(currentCommit, {commitTime: commitTime, files: []})
    } else if (currentCommit) {
      changedFiles.get(currentCommit)?.files.push(gitLogLine as RelativeFilePath)
    } else {
      throw new Error(`something is wrong here: ${gitLogLine}`)
    }
  }
}

function addChangedFilesFromGitStatus(
  changedFiles: ChangedFilesInGit,
  statusResult: {stdout: string},
) {
  const statusLines = statusResult.stdout
    .split('\n')
    .filter((l) => !!l)
    .filter((l) => !l.startsWith('?'))
  for (const statusLine of statusLines) {
    const stagingStatus = statusLine[0]
    const workspaceStatus = statusLine[1]
    const fileName = statusLine.slice(3)

    if (stagingStatus === ' ' && workspaceStatus === ' ') continue

    if (changedFiles.has(FAKE_COMMITISH_FOR_UNCOMMITED_FILES)) {
      changedFiles
        .get(FAKE_COMMITISH_FOR_UNCOMMITED_FILES)
        ?.files.push(fileName as RelativeFilePath)
    } else {
      changedFiles.set(FAKE_COMMITISH_FOR_UNCOMMITED_FILES, {
        commitTime: new Date(),
        files: [fileName as RelativeFilePath],
      })
    }
  }
}

function addUntrackedFiles(changedFiles: ChangedFilesInGit, lsFilesResult: {stdout: string}) {
  const statusLines = lsFilesResult.stdout.split('\n').filter((l) => !!l)
  for (const statusLine of statusLines) {
    if (changedFiles.has(FAKE_COMMITISH_FOR_UNCOMMITED_FILES)) {
      changedFiles
        .get(FAKE_COMMITISH_FOR_UNCOMMITED_FILES)
        ?.files.push(statusLine.trim() as RelativeFilePath)
    } else {
      changedFiles.set(FAKE_COMMITISH_FOR_UNCOMMITED_FILES, {
        commitTime: new Date(),
        files: [statusLine.trim() as RelativeFilePath],
      })
    }
  }
}
