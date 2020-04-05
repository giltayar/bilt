'use strict'
const {promisify} = require('util')
const fs = require('fs')
const os = require('os')
const {once} = require('events')
const {spawn, exec} = require('child_process')

/**
 * @param {string} command
 * @param {{
 * cwd: string
 * }} params
 */
async function sh(command, {cwd}) {
  const childProcess = spawn(command, {cwd, stdio: 'inherit', shell: true})
  const [result] = await Promise.race([once(childProcess, 'error'), once(childProcess, 'exit')])
  if (typeof result === 'number') {
    if (result !== 0) {
      const error = new Error(
        `Command failed: ${command} ${result === 127 ? 'command not found' : ''}\n`,
      )
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
 * }} params
 */
async function shWithOutput(command, {cwd}) {
  const {stdout} = await promisify(exec)(command, {cwd})

  return stdout
}

/**
 * @returns {Promise<string>}
 */
async function makeTemporaryDirectory() {
  return await fs.promises.mkdtemp(os.tmpdir() + '/')
}

module.exports = {sh, shWithOutput, makeTemporaryDirectory}
