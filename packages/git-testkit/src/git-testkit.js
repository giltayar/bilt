'use strict'
import {promisify} from 'util'
import {promises} from 'fs'
import {join, dirname} from 'path'
import {tmpdir} from 'os'
import {exec, execFile} from 'child_process'
const execAsync = promisify(exec)

/**@return {Promise<string>} */
export async function makeTemporaryDirectory() {
  return await promises.mkdtemp(tmpdir() + '/')
}

/**
 * @param {string} gitDir
 * @param {{bare?: boolean, origin?: string}} options
 * @return {Promise<void>}
 */
export async function init(gitDir, {bare, origin} = {}) {
  await execAsync(`git init ${bare ? '--bare' : ''} -b master`, {cwd: gitDir})
  if (origin) {
    await execAsync(`git remote add origin ${origin}`, {cwd: gitDir})
    await execAsync(`git commit -m "first commit" --allow-empty`, {cwd: gitDir})
    await execAsync(`git push --set-upstream origin master`, {cwd: gitDir})
  }
}

/**@return {Promise<void>} */
export async function writeFile(
  /**@type {string} */ gitDir,
  /**@type {string} */ filePath,
  /**@type {string|Buffer} */ content,
) {
  await promises.writeFile(join(gitDir, filePath), content)
}

/**@return {Promise<void>} */
export async function writePackageJson(
  /**@type {string} */ gitDir,
  /**@type {string} */ filePath,
  /**@type {string} */ name,
  /**@type {string[]} */ ...dependencies
) {
  await promises.mkdir(dirname(join(gitDir, filePath)), {recursive: true})
  await promises.writeFile(
    join(gitDir, filePath),
    JSON.stringify({
      name,
      version: '1.0.0',
      //@ts-ignore
      dependencies: Object.fromEntries(dependencies.map((dep) => [dep, '^1.0.0'])),
    }),
  )
}

/**@return {Promise<void>} */
export async function commitAll(
  /**@type {string} */ gitDir,
  /**@type {string|undefined} */ message = undefined,
) {
  await execAsync('git add .', {cwd: gitDir})
  await execAsync(`git commit -m "${message ? 'message' : 'nomessage'}"`, {cwd: gitDir})
}

/**@typedef {{[commit: string]: string[]}} ChangedFilesInGit*/

/**
 * @type {(
 * rootDirectory: string,
 * options: {fromGitDate?: string, toCommit?: string}) =>
 * Promise<ChangedFilesInGit>
 * }
 * */
export async function commitHistory(
  rootDirectory,
  {fromGitDate = 'one year ago', toCommit = 'HEAD'} = {},
) {
  const COMMIT_PREFIX_IN_LOG = '----'
  const diffTreeResult = await promisify(execFile)(
    'git',
    [
      'log',
      `--format=format:${COMMIT_PREFIX_IN_LOG}%H`,
      '--name-only',
      `--since="${fromGitDate}"`,
      toCommit,
    ],
    {
      cwd: rootDirectory,
    },
  )
  const gitLogLines = diffTreeResult.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !!l)

  /**@type {ChangedFilesInGit} */
  const ret = {}

  for (const gitLogLine of gitLogLines) {
    var currentCommit //eslint-disable-line
    if (gitLogLine.startsWith(COMMIT_PREFIX_IN_LOG)) {
      currentCommit = gitLogLine.trim().slice(COMMIT_PREFIX_IN_LOG.length)
      ret[currentCommit] = []
    } else if (currentCommit) {
      ret[currentCommit].push(gitLogLine)
    } else {
      throw new Error(`something is wrong here: ${gitLogLine}`)
    }
  }

  return ret
}

/**
 * @type {(
 * rootDirectory: string,
 * options: {fromGitDate?: string, toCommit?: string}) =>
 * Promise<string[]>
 * }
 * */
export async function commitMessagesHistory(
  rootDirectory,
  {fromGitDate = 'one year ago', toCommit = 'HEAD'} = {},
) {
  const COMMIT_PREFIX_IN_LOG = '----'
  const diffTreeResult = await promisify(execFile)(
    'git',
    [
      'log',
      `--format=format:${COMMIT_PREFIX_IN_LOG}%s`,
      '--name-only',
      `--since="${fromGitDate}"`,
      toCommit,
    ],
    {
      cwd: rootDirectory,
    },
  )
  const gitLogLines = diffTreeResult.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !!l)

  return gitLogLines
    .filter((line) => line.startsWith(COMMIT_PREFIX_IN_LOG))
    .map((line) => line.trim().slice(COMMIT_PREFIX_IN_LOG.length))
}
