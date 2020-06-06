'use strict'
const {promisify} = require('util')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {once} = require('events')
const {spawn, exec} = require('child_process')

/**
 * @param {string} command
 * @param {{
 * cwd: string
 * env?: object|undefined
 * }} params
 */
async function sh(command, {cwd, env}) {
  const childProcess = spawn(command, {cwd, stdio: 'inherit', shell: true, env})
  const [result] = await Promise.race([once(childProcess, 'error'), once(childProcess, 'exit')])
  if (typeof result === 'number') {
    if (result !== 0) {
      const error = new Error(`Command failed: ${command} ${result === 127 ? '(not found)' : ''}\n`)
      //@ts-ignore
      error.code = result

      throw error
    } else {
      return
    }
  } else {
    throw result
  }
}

/**
 * @param {string} command
 * @param {{
 * cwd: string
 * env?: object|undefined
 * }} params
 */
async function shWithOutput(command, {cwd, env}) {
  const {stdout} = await promisify(exec)(command, {cwd, env})

  return stdout
}

/**
 * @param {string | string[]} file
 * @param {Buffer|string|object} content
 * @param {{cwd: string}} options
 * @returns {Promise<void>}
 */
async function writeFile(file, content, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  file = path.join(cwd, file)

  await fs.promises.mkdir(path.dirname(file), {recursive: true})
  await fs.promises.writeFile(file, typeof content === 'object' ? JSON.stringify(content) : content)
}

/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<string>}
 */
async function readFileAsString(file, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  file = path.join(cwd, file)

  return await fs.promises.readFile(file, 'utf-8')
}

/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<object>}
 */
async function readFileAsJson(file, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  return JSON.parse(await fs.promises.readFile(path.join(cwd, file), 'utf-8'))
}

/**
 * @returns {Promise<string>}
 */
async function makeTemporaryDirectory() {
  return await fs.promises.mkdtemp(os.tmpdir() + '/')
}

module.exports = {
  sh,
  shWithOutput,
  makeTemporaryDirectory,
  writeFile,
  readFileAsString,
  readFileAsJson,
}
