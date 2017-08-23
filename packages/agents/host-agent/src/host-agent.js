const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const debug = require('debug')('bildit:host-agent')
const {createSymlink: createSymlinkInHost} = require('@bildit/symlink')

module.exports = async ({pluginInfo: {job: {directory}}}) => {
  return {
    async executeCommand(commandArgs, {cwd}) {
      debug('dispatching command %o in directory %s', commandArgs, directory)
      await new Promise((resolve, reject) => {
        const process = childProcess.spawn(commandArgs[0], commandArgs.slice(1), {
          cwd: path.join(directory, cwd),
          stdio: 'inherit',
          shell: false,
        })

        process.on('close', code => {
          if (code !== 0) reject(new Error(`Command failed with errorcode ${code}`))
          else resolve()
        })
        process.on('error', err => {
          reject(err)
        })
      })
    },

    async readFileAsBuffer(fileName) {
      return await promisify(fs.readFile)(path.resolve(directory, fileName))
    },

    async fetchRepo(repository, {}) {
      return repository
    },
    async createSymlink(link, target) {
      return await createSymlinkInHost(path.join(directory, link), path.join(directory, target))
    },

  }
}
