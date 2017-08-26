const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const debug = require('debug')('bildit:host-agent')
const {createSymlink: createSymlinkInHost} = require('@bildit/symlink')

module.exports = async ({pluginInfo: {job: {directory}}}) => {
  return {
    async executeCommand(commandArgs, {cwd, returnOutput} = {}) {
      debug('dispatching command %o in directory %s', commandArgs, directory)
      const output = await new Promise((resolve, reject) => {
        const process = childProcess.spawn(commandArgs[0], commandArgs.slice(1), {
          cwd: path.join(directory, cwd || '.'),
          stdio: returnOutput ? undefined : 'inherit',
          shell: false,
        })

        let output = ''
        if (returnOutput) {
          process.stdout.on('data', data => (output += data.toString()))
        }

        process.on('close', code => {
          if (code !== 0) reject(new Error(`Command failed with errorcode ${code}`))
          else resolve(output)
        })
        process.on('error', err => {
          reject(err)
        })
      })

      return output
    },

    async readFileAsBuffer(fileName) {
      return await promisify(fs.readFile)(path.resolve(directory, fileName))
    },

    async writeBufferToFile(fileName, buffer) {
      return await promisify(fs.writeFile)(path.resolve(directory, fileName), buffer)
    },

    async fetchRepo(repository, {}) {
      return repository
    },

    async homeDir() {
      if (!process.env.HOME) {
        throw new Error(
          'There is no HOME directory environment variable so cannot determine home directory',
        )
      }
      return process.env.HOME
    },

    async createSymlink(link, target) {
      return await createSymlinkInHost(path.join(directory, link), path.join(directory, target))
    },

    async destroy() {
      //
    },
  }
}
