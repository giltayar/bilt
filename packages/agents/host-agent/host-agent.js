const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const debug = require('debug')('bildit:host-agent')

module.exports = async ({pluginInfo: {cwd = '.'}} = {}) => {
  return {

    async executeCommand(commandArgs, {shell = false} = {}) {
      debug('dispatching command %o in directory %s', commandArgs, cwd)
      await new Promise((resolve, reject) => {
        const process = childProcess.spawn(commandArgs[0], commandArgs.slice(1), {
          cwd,
          stdio: 'inherit',
          shell,
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
      return await promisify(fs.readFile)(path.resolve(cwd, fileName))
    },
  }
}
