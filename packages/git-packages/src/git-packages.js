import {promisify} from 'util'
import {execFile} from 'child_process'

/**
 * @typedef {import('@bilt/types').RelativeFilePath} RelativeFilePath
 * @typedef {import('@bilt/types').Commitish} Commitish
 * @typedef {import('@bilt/types').Directory} Directory
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('@bilt/types').RelativeDirectoryPath} RelativeDirectoryPath
 */

/**
 * @typedef {{commitTime: Date; files: RelativeFilePath[]}} CommitInfo
 * @typedef {Map<Commitish, CommitInfo>} ChangedFilesInGit
 */

export const FAKE_COMMITISH_FOR_UNCOMMITED_FILES = /**@type {Commitish} */ ('')

const COMMIT_PREFIX_IN_LOG = '----'

/**
 * @param {{
 *  fromGitDate?: string
 *  toCommit?: Commitish
 *  rootDirectory?: Directory
 *  includeWorkspaceFiles?: boolean
 * }} options
 * @returns {Promise<ChangedFilesInGit>}
 */
export async function findChangedFiles({
  rootDirectory,
  fromGitDate = '1 year ago',
  toCommit = /**@type {Commitish}*/ ('HEAD'),
  includeWorkspaceFiles = true,
}) {
  const [diffTreeResult, statusResult, lsFilesResult] = await Promise.all([
    promisify(execFile)(
      'git',
      [
        'log',
        `--format=format:${COMMIT_PREFIX_IN_LOG}%cd$%H`,
        '--date=iso',
        '--name-only',
        `--since="${fromGitDate}"`,
        toCommit,
      ],
      {
        cwd: rootDirectory,
        maxBuffer: 1024 * 1024 * 1024,
      },
    ),
    promisify(execFile)('git', ['status', `--porcelain`, '--no-renames'], {
      cwd: rootDirectory,
      maxBuffer: 1024 * 1024 * 1024,
    }),
    promisify(execFile)('git', ['ls-files', `--others`, '--exclude-standard'], {
      cwd: rootDirectory,
      maxBuffer: 1024 * 1024 * 1024,
    }),
  ])

  const ret = /**@type {Map<Commitish, CommitInfo>}*/ (new Map())

  if (includeWorkspaceFiles) {
    addChangedFilesFromGitStatus(ret, statusResult)
    addUntrackedFiles(ret, lsFilesResult)
  }
  addChangedFilesFromDiffTree(ret, diffTreeResult)

  return ret
}

/**
 */

/**
 * @typedef {{
 *  package: Package
 *  commit: Commitish
 *  commitTime: Date
 * }} PackageChange
 */

/**
 *
 * @param {{
 *  changedFilesInGit: ChangedFilesInGit
 *  packages: Package[]
 * }} options
 * @returns {PackageChange[]}
 */
export function findLatestPackageChanges({changedFilesInGit, packages}) {
  const lastCommitOfPackages = /**@type {Map<RelativeDirectoryPath, [Commitish, CommitInfo]>} */ (new Map())

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

/**
 * @param {ChangedFilesInGit} changedFiles
 * @param {{stdout: string}} diffTreeResult
 */
function addChangedFilesFromDiffTree(changedFiles, diffTreeResult) {
  const gitDiffTreeLogLines = /**@type {RelativeFilePath[]}*/ (diffTreeResult.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !!l))
  /**@type {Commitish|undefined} */
  let currentCommit = undefined
  for (const gitLogLine of gitDiffTreeLogLines) {
    if (gitLogLine.startsWith(COMMIT_PREFIX_IN_LOG)) {
      const currentCommitWithTime = gitLogLine.trim().slice(COMMIT_PREFIX_IN_LOG.length).split('$')
      const commitTime = new Date(currentCommitWithTime[0])
      currentCommit = /**@type {Commitish} */ (currentCommitWithTime[1])

      changedFiles.set(currentCommit, {commitTime: commitTime, files: []})
    } else if (currentCommit) {
      changedFiles.get(currentCommit)?.files.push(gitLogLine)
    } else {
      throw new Error(`something is wrong here: ${gitLogLine}`)
    }
  }
}

/**
 * @param {ChangedFilesInGit} changedFiles
 * @param {{stdout: string}} statusResult
 */
function addChangedFilesFromGitStatus(changedFiles, statusResult) {
  const statusLines = statusResult.stdout
    .split('\n')
    .filter((l) => !!l)
    .filter((l) => !l.startsWith('?'))
  for (const statusLine of statusLines) {
    const stagingStatus = statusLine[0]
    const workspaceStatus = statusLine[1]
    const fileName = /**@type {RelativeFilePath}*/ (statusLine.slice(3))

    if (stagingStatus === ' ' && workspaceStatus === ' ') continue

    if (changedFiles.has(FAKE_COMMITISH_FOR_UNCOMMITED_FILES)) {
      changedFiles.get(FAKE_COMMITISH_FOR_UNCOMMITED_FILES)?.files.push(fileName)
    } else {
      changedFiles.set(FAKE_COMMITISH_FOR_UNCOMMITED_FILES, {
        commitTime: new Date(),
        files: [fileName],
      })
    }
  }
}

/**
 * @param {ChangedFilesInGit} changedFiles
 * @param {{stdout: string}} lsFilesResult
 */
function addUntrackedFiles(changedFiles, lsFilesResult) {
  const statusLines = /**@type {RelativeFilePath[]} */ (lsFilesResult.stdout
    .split('\n')
    .filter((l) => !!l)
    .map((s) => s.trim()))
  for (const statusLine of statusLines) {
    if (changedFiles.has(FAKE_COMMITISH_FOR_UNCOMMITED_FILES)) {
      changedFiles.get(FAKE_COMMITISH_FOR_UNCOMMITED_FILES)?.files.push(statusLine)
    } else {
      changedFiles.set(FAKE_COMMITISH_FOR_UNCOMMITED_FILES, {
        commitTime: new Date(),
        files: [statusLine],
      })
    }
  }
}
