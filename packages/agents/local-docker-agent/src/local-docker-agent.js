const path = require('path')
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

  async function executeCommand(commandArgs, {cwd}) {
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
    await new Promise((resolve, reject) => {
      execStream.output
        .on('data', data => process.stdout.write(data.toString()))
        .on('error', reject)
        .on('end', resolve)
    })
    const {ExitCode: code} = await execution.inspect()
    debug('executed %o in container %s with exit %d', commandArgs, container.id.slice(0, 6), code)
    if (code !== 0) throw new Error(`Command failed with errorcode ${code}`)
  }

  return {
    executeCommand,

    async readFileAsBuffer(fileName) {
      const fullFilename = path.join(workdir, fileName)

      debug('reading file %s in container %s', fullFilename, container.id.slice(0, 6))
      const fileContent = await tarStreamToFileContent(
        await container.getArchive({path: fullFilename}),
      )
      debug('read and got %s', fileContent.toString())

      return fileContent
    },

    async fetchRepo() {
      //
    },

    async createSymlink(link, target) {
      debug('creating symlink in directory %s, link %s, target %s', workdir, link, target)

      // This is a very strange symlink - it is created in the host, and therefore resides in `directory`
      // and yet it points to a directory that is in the docker container, and therefore
      // uses `workdir`.
      // This is OK, because the file will always be read _inside_ the container.
      return await createSymlinkInHost(path.join(directory, link), path.join(workdir, target))
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
