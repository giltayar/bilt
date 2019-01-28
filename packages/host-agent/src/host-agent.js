const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const makeDir = require('make-dir')
const split2 = require('split2')
const debug = require('debug')('bilt:host-agent')
const {createSymlink: createSymlinkInHost} = require('@bilt/symlink')

/**
 *
 * @param {{command: string, cwd: string, returnOutput: boolean, callOnEachLine: (line: string) => void, env: object}} options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function executeCommand({command, cwd, returnOutput, callOnEachLine, env} = {}) {
  debug('dispatching command %o in directory %s', command, cwd)
  const orgEnv = process.env
  const output = await new Promise((resolve, reject) => {
    const process = childProcess.spawn(command[0], command.slice(1), {
      cwd,
      stdio: returnOutput ? undefined : callOnEachLine ? 'pipe' : 'inherit',
      shell: false,
      env: {...orgEnv, ...env},
    })

    let stdout = ''
    let stderr = ''
    if (returnOutput) {
      process.stdout.on('data', data => (stdout += data.toString()))
      process.stderr.on('data', data => (stderr += data.toString()))
    } else if (callOnEachLine) {
      process.stdout.pipe(split2()).on('data', line => callOnEachLine({line, outTo: 'stdout'}))
      process.stderr.pipe(split2()).on('data', line => callOnEachLine({line, outTo: 'stderr'}))
    }

    process.on('close', code => {
      if (code !== 0) {
        const err = new Error(`Command ${command.join(' ')} failed with errorcode ${code}`)
        Object.assign(err, {stdout, stderr})
        reject(err)
      } else {
        resolve({stdout, stderr})
      }
    })
    process.on('error', err => {
      Object.assign(err, {stdout, stderr})
      reject(err)
    })
  })

  return output
}

/**
 *
 * @param {string} fileName
 * @return {Promise<Buffer>}
 */
async function readFileAsBuffer(fileName) {
  return await promisify(fs.readFile)(fileName)
}

/**
 *
 * @param {string} fileOrDirName
 * @returns {boolean}
 */
async function pathExists(fileOrDirName) {
  return await promisify(fs.stat)(fileOrDirName).catch(
    err => (err.code === 'ENOENT' ? false : Promise.reject(err)),
  )
}

/**
 *
 * @param {string} fileName
 * @param {Buffer} buffer
 * @returns {Promise<void>}
 */
async function writeBufferToFile(fileName, buffer) {
  const dir = path.dirname(fileName)

  await makeDir(dir)

  return await promisify(fs.writeFile)(fileName, buffer)
}

/**
 * @returns {string}
 */
async function homeDir() {
  if (!process.env.HOME) {
    throw new Error(
      'There is no HOME directory environment variable so cannot determine home directory',
    )
  }
  return process.env.HOME
}

/**
 *
 * @param {string} link The file that is to be created
 * @param {string} target The file that is to be linked to
 *
 * @returns {Promise<void>}
 */
async function createSymlink(link, target) {
  return await createSymlinkInHost(link, target)
}

module.exports = {
  executeCommand,
  readFileAsBuffer,
  pathExists,
  writeBufferToFile,
  homeDir,
  createSymlink,
}
