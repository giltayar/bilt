'use strict'
const {promisify} = require('util')
const {once} = require('events')
const {spawn, exec} = require('child_process')

/**
 * @param {string} command
 * @param {{
 * cwd: string
 * }} params
 */
async function sh(command, {cwd}) {
  const childProcess = spawn(command, {cwd, stdio: 'inherit'})
  const [[exitCode], [error]] = await Promise.race([
    once(childProcess, 'error'),
    once(childProcess, 'exit'),
  ])
  if (error) {
    throw error
  } else if (exitCode !== 0) {
    throw new Error(`'${command}' failed with exit code ${exitCode}`)
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

module.exports = {sh, shWithOutput}
