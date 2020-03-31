'use strict'
const {promisify} = require('util')
const fs = require('fs')
const path = require('path')
const os = require('os')
const {exec} = require('child_process')
const execAsync = promisify(exec)

/**@return {Promise<string>} */
async function makeTemporaryDirectory() {
  return await fs.promises.mkdtemp(os.tmpdir() + '/')
}

/**@return {Promise<void>} */
async function init(/**@type {string} */ gitDir) {
  await execAsync('git init', {cwd: gitDir})
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
      dependencies: Object.fromEntries(dependencies.map((dep) => [dep, '^1.0.0'])),
    }),
  )
}

/**@return {Promise<void>} */
async function commitAll(/**@type {string} */ gitDir, /**@type {string?} */ message = undefined) {
  await execAsync('git add .', {cwd: gitDir})
  await execAsync(`git commit -m "${message ? 'message' : 'nomessage'}"`, {cwd: gitDir})
}

module.exports = {
  makeTemporaryDirectory,
  init,
  writeFile,
  writePackageJson,
  commitAll,
}
