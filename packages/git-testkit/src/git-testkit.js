'use strict'
const {promisify} = require('util')
const fs = require('fs')
const path = require('path')
const os = require('os')
const {exec, execFile} = require('child_process')
const execAsync = promisify(exec)

/**@return {Promise<string>} */
async function makeTemporaryDirectory() {
  return await fs.promises.mkdtemp(os.tmpdir() + '/')
}

/**
 * @param {string} gitDir
 * @param {{bare?: boolean, origin?: string}} options
 * @return {Promise<void>}
 */
async function init(gitDir, {bare, origin} = {}) {
  await execAsync(`git init ${bare ? '--bare' : ''}`, {cwd: gitDir})
  if (origin) {
    await execAsync(`git remote add origin ${origin}`, {cwd: gitDir})
    await execAsync(`git commit -m "first commit" --allow-empty`, {cwd: gitDir})
    await execAsync(`git push --set-upstream origin master`, {cwd: gitDir})
  }
}

/**@return {Promise<void>} */
async function writeFile(
  /**@type {string} */ gitDir,
  /**@type {string} */ filePath,
  /**@type {string|Buffer} */ content,
) {
  await fs.promises.writeFile(path.join(gitDir, filePath), content)
}

/**@return {Promise<void>} */
async function writePackageJson(
  /**@type {string} */ gitDir,
  /**@type {string} */ filePath,
  /**@type {string} */ name,
  /**@type {string[]} */ ...dependencies
) {
  await fs.promises.mkdir(path.dirname(path.join(gitDir, filePath)), {recursive: true})
  await fs.promises.writeFile(
    path.join(gitDir, filePath),
    JSON.stringify({
      name,
      version: '1.0.0',
      //@ts-ignore
      dependencies: Object.fromEntries(dependencies.map((dep) => [dep, '^1.0.0'])),
    }),
  )
}

/**@return {Promise<void>} */
async function commitAll(
  /**@type {string} */ gitDir,
  /**@type {string|undefined} */ message = undefined,
) {
  await execAsync('git add .', {cwd: gitDir})
  await execAsync(`git commit -m "${message ? 'message' : 'nomessage'}"`, {cwd: gitDir})
}

/**@typedef {{[commit: string]: string[]}} ChangedFilesInGit*/

/**@type {(
 * rootDirectory: string,
 * options: {fromGitDate?: string, toCommit?: string}) =>
 * Promise<ChangedFilesInGit>
 * } */
async function commitHistory(
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

module.exports = {
  makeTemporaryDirectory,
  init,
  writeFile,
  writePackageJson,
  commitAll,
  commitHistory,
}
