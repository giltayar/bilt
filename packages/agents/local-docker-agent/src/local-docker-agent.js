const path = require('path')
const assert = require('assert')
const debug = require('debug')('bildit:local-docker-agent')
const Docker = require('dockerode')
const tar = require('tar-stream')
const {createSymlink: createSymlinkInHost} = require('@bildit/symlink')

module.exports = async ({pluginInfo: {job: {kind, directory}}, pluginConfig}) => {
  const docker = new Docker({Promise})

  const {
    image,
    start = ['sleep', '100000000'],
    user = 'root',
    workdir = '/usr/work',
  } = pluginConfig[kind]

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
  let started = true

  async function executeCommand(commandArgs, {cwd, returnOutput}) {
    assert(started, 'container is being used after it was destroyed')
    const finalCommand = cwd ? ['sh', '-c', `cd '${cwd}' && ${commandArgs.join(' ')}`] : commandArgs
    debug(
      'dispatching command %o in directory %s, container %s',
      finalCommand,
      path.join(workdir, cwd),
      container.id.slice(0, 6),
    )
    debug('executing %o in container %s', commandArgs, container.id.slice(0, 6))
    const execution = await container.exec({
      Cmd: finalCommand,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    })
    const execStream = await execution.start({Tty: true})
    let output = ''
    await new Promise((resolve, reject) => {
      execStream.output
        .on('data', data => {
          process.stdout.write(data.toString())
          if (returnOutput) output += data.toString()
        })
        .on('error', reject)
        .on('end', resolve)
    })
    const {ExitCode: code} = await execution.inspect()
    debug('executed %o in container %s with exit %d', commandArgs, container.id.slice(0, 6), code)
    if (code !== 0) throw new Error(`Command failed with errorcode ${code}`)

    return returnOutput ? output : undefined
  }

  return {
    executeCommand,

    async readFileAsBuffer(fileName) {
      assert(started, 'container is being used after it was destroyed')
      const fullFilename = path.join(workdir, fileName)

      debug('reading file %s in container %s', fullFilename, container.id.slice(0, 6))
      const fileContent = await tarStreamToFileContent(
        await container.getArchive({path: fullFilename}),
      )
      debug('read and got %s', fileContent.toString())

      return fileContent
    },

    async writeBufferToFile(fileName, buffer) {
      const fullFilename = path.resolve(directory, fileName)

      await container.putArchive(toTarStream(path.basename(fullFilename), buffer), {
        path: path.dirname(fullFilename),
      })
    },

    async homeDir() {
      const homeDir = await executeCommand(['echo', '$HOME'], {cwd: '/', returnOutput: true})

      debug('home dir is %s', homeDir)

      return homeDir.trim()
    },

    async fetchRepo() {
      assert(started, 'container is being used after it was destroyed')
    },

    async createSymlink(link, target) {
      assert(started, 'container is being used after it was destroyed')
      debug('creating symlink in directory %s, link %s, target %s', workdir, link, target)

      // This is a very strange symlink - it is created in the host, and therefore resides in `directory`
      // and yet it points to a directory that is in the docker container, and therefore
      // uses `workdir`.
      // This is OK, because the file will always be read _inside_ the container.
      return await createSymlinkInHost(path.join(directory, link), path.join(workdir, target))
    },
    async destroy() {
      debug('killing container %s', container.id)
      await container.remove({force: true, v: true})
      started = false
    },
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

async function toTarStream(fileName, buffer) {
  const pack = tar.pack()

  pack.entry({name: fileName}, buffer)

  return pack
}
