const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const debug = require('debug')('bilt:host-agent')
const {createSymlink: createSymlinkInHost} = require('@bilt/symlink')
const makeDir = require('make-dir')

module.exports = async ({kind}) => {
  const info = agent => agent

  return {
    async acquireInstanceForJob() {
      return {id: 1, kind}
    },
    releaseInstanceForJob() {
      return
    },

    async executeCommand({command, cwd, returnOutput, env} = {}) {
      debug('dispatching command %o in directory %s', command, cwd)
      const orgEnv = process.env
      const output = await new Promise((resolve, reject) => {
        const process = childProcess.spawn(command[0], command.slice(1), {
          cwd,
          stdio: returnOutput ? undefined : 'inherit',
          shell: false,
          env: {...orgEnv, ...env},
        })

        let stdout = ''
        let stderr = ''
        if (returnOutput) {
          process.stdout.on('data', data => (stdout += data.toString()))
          process.stderr.on('data', data => (stderr += data.toString()))
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
    },

    async readFileAsBuffer(agentInstance, fileName) {
      return await promisify(fs.readFile)(fileName)
    },

    async pathExists(agentInstance, fileOrDirName) {
      return await promisify(fs.exists)(fileOrDirName)
    },

    async writeBufferToFile(agentInstance, fileName, buffer) {
      const {directory} = info(agentInstance)

      const fullFilename = path.resolve(directory, fileName)
      const dir = path.dirname(fullFilename)
      await makeDir(dir)

      return await promisify(fs.writeFile)(fullFilename, buffer)
    },

    async homeDir() {
      if (!process.env.HOME) {
        throw new Error(
          'There is no HOME directory environment variable so cannot determine home directory',
        )
      }
      return process.env.HOME
    },

    buildDir() {
      return '.'
    },
    translateHostPathToAgentPath(path) {
      return path
    },
    async createSymlink(agentInstance, link, target) {
      return await createSymlinkInHost(link, target)
    },

    async finalize() {
      //
    },
  }
}
