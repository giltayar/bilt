const Docker = require('dockerode')

main().catch(err => console.error(err.stack))

async function main() {
  const docker = new Docker()
  const container = await docker.createContainer({
    Image: 'alpine',
    Cmd: ['sleep', '10000000'],
  })

  console.log('starting...', container.id)
  await container.start()

  console.log('execing...')
  const execution = await container.exec({
    Cmd: ['ls'],
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  })
  console.log('starting exec...')
  const execStream = await execution.start({Tty: true})
  await new Promise(resolve => {
    execStream.output
      .on('data', data => console.log(data.toString()))
      .on('err', err => console.error(err))
      .on('end', () => resolve())
  })
  const data = await execution.inspect()
  console.log('waiting...', data.ExitCode)
}
