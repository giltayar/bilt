const path = require('path')
const debug = require('debug')('bildit:local-docker-agent')
const Docker = require('dockerode')
const tar = require('tar-stream')

const {createSymlink: createSymlinkInHost} = require('@bildit/symlink')

module.exports = async ({
  pluginConfig: {
    image = 'alpine',
    start = ['sleep', '100000000'],
    user = 'root',
    workdir = '/usr/work',
  },
}) => {
  const docker = new Docker({Promise})
  const runningAgents = new Map()
  const waitingAgents = new Map()

  const info = agent => ({
    container: runningAgents.get(agent.directory).container,
    directory: agent.directory,
  })

  return {
    async acquireInstanceForJob({repository}) {
      const directory = repository

      if (waitingAgents.has(directory)) {
        const agentInstance = waitingAgents.get(directory)

        runningAgents.set(directory, agentInstance)
        waitingAgents.delete(directory)

        return {directory, id: agentInstance.container.id}
      }

      const container = await createContainer(directory)

      runningAgents.set(directory, {container})

      return {directory, id: container.id}
    },

    executeCommand,

    async readFileAsBuffer(agentInstance, fileName) {
      const {container} = info(agentInstance)
      const fullFilename = path.join(workdir, fileName)

      debug('reading file %s in container %s', fullFilename, container.id.slice(0, 6))
      const fileContent = await tarStreamToFileContent(
        await container.getArchive({path: fullFilename}),
      )
      debug('read and got %s', fileContent.toString())

      return fileContent
    },

    async writeBufferToFile(agentInstance, fileName, buffer) {
      const {container, directory} = info(agentInstance)

      const fullFilename = path.resolve(directory, fileName)

      const dirname = path.dirname(fullFilename)

      debug('creating directory %s in container %s', dirname, container.id)
      await executeCommand(agentInstance, ['mkdir', '-p', dirname])

      debug(
        'writing buffer (length %d) to file %s in container %s',
        buffer.length,
        fullFilename,
        container.id,
      )

      await container.putArchive(toTarStream(path.basename(fullFilename), buffer), {
        path: dirname,
      })
    },

    async homeDir(agentInstance) {
      const homeDir = await executeCommand(agentInstance, ['echo', '$HOME'], {
        cwd: '/',
        returnOutput: true,
      })

      debug('home dir is %s', homeDir)

      return homeDir.trim()
    },

    buildDir() {
      return '.'
    },

    async createSymlink(agentInstance, link, target) {
      const {directory} = info(agentInstance)
      dug('creating symlink in directory %s, link %s, target %s', workdir, link, target)

      // This is a very strange symlink - it is created in the host, and therefore resides in `directory`
      // and yet it points to a directory that is in the docker container, and therefore
      // uses `workdir`.
      // This is OK, because the file will always be read _inside_ the container.
      return await createSymlinkInHost(path.join(directory, link), path.join(workdir, target))
    },

    async finalize() {
      await Promise.all(
        [...waitingAgents, ...runningAgents].map(async ([_, {container}]) => {
          debug('killing container %s', container.id)

          await container.remove({force: true, v: true})
        }),
      )
    },
  }

  async function executeCommand(agentInstance, commandArgs, {cwd, returnOutput, env} = {}) {
    const {container} = info(agentInstance)

    const finalCommand = cwd ? ['sh', '-c', `cd '${cwd}' && ${commandArgs.join(' ')}`] : commandArgs
    debug(
      'dispatching command %o in directory %s, container %s',
      finalCommand,
      cwd ? path.join(workdir, cwd) : '<default>',
      container.id.slice(0, 6),
    )
    debug('executing %o in container %s', commandArgs, container.id.slice(0, 6))
    const execution = await container.exec({
      Cmd: finalCommand,
      AttachStdout: true,
      AttachStderr: true,
      Env: env ? Object.entries(env).map(([var, value]) => `${var}=${value}`) : undefined,
      Tty: !returnOutput,
    })
    const execStream = await execution.start({Tty: !returnOutput})
    let output = ''
    const passThrough = require('through2')(function(chunk, enc, cb) {
      output += chunk.toString()
      process.stdout.write(chunk.toString())
      this.push(chunk)
      cb()
    })
    if (returnOutput) {
      container.modem.demuxStream(execStream.output, passThrough, passThrough)
    }
    await new Promise((resolve, reject) => {
      if (!returnOutput) {
        execStream.output.on('data', data => {
          process.stdout.write(data.toString())
        })
      }
      execStream.output.on('error', reject).on('end', resolve)
    })
    const {ExitCode: code} = await execution.inspect()
    debug('executed %o in container %s with exit %d', commandArgs, container.id.slice(0, 6), code)
    if (code !== 0) throw new Error(`Command failed with errorcode ${code}`)

    if (returnOutput) {
      return output
    }
  }

  async function createContainer(directory) {
    const container = await docker.createContainer({
      Image: image,
      Tty: true,
      Volumes: {
        [workdir]: {},
      },
      Cmd: start,
      WorkingDir: workdir,
      Hostconfig: {
        Binds: [`${directory}:${workdir}`],
      },
      User: user,
    })
    debug(
      'created container %s from image %s, workdir %s mapped to %s',
      container.id,
      image,
      workdir,
      directory,
    )
    await container.start()
    debug('started container %s', container.id)

    return container
  }
}

async function tarStreamToFileContent(tarStream) {
  return new Promise((resolve, reject) => {
    const extract = tar.extract()

    extract
      .on('entry', (header, stream, next) => {
        let content = new Buffer(0)
        stream
          .on('data', data => (content = Buffer.concat([content, data])))
          .on('end', () => {
            resolve(content)
            next()
          })
          .on('error', reject)
          .resume() // just auto drain the stream
      })
      .on('error', reject)

    tarStream.pipe(extract)
  })
}

function toTarStream(fileName, buffer) {
  const pack = tar.pack()

  pack.entry({name: fileName}, buffer)

  pack.finalize()

  return pack
}
