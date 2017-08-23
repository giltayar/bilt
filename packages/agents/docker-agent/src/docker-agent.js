const path = require('path')
const debug = require('debug')('bildit:docker-agent')
const Docker = require('dockerode')
const streamToPromise = require('stream-to-promise')
const tar = require('tar-stream')

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
  debug('created container %s from image %s, workdir %s', container.id, image, workdir)
  await container.start()
  debug('started container %s', container.id)

  async function executeCommand(commandArgs) {
    debug(
      'dispatching command %o in directory %s, container %s',
      commandArgs,
      directory,
      container.id.slice(0, 6),
    )
    debug('executing %o in container %s', commandArgs, container.id.slice(0, 6))
    const execution = await container.exec({
      Cmd: commandArgs,
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

    async fetchRepo(repository, {}) {
      return repository
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
