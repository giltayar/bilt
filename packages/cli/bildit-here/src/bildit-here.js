'use strict'

const debug = require('debug')('bildit:bildit-here')
const pluginRepoFactory = require('@bildit/config-based-plugin-repository')
const path = require('path')
;(async () => {
  const folderToBuild = path.resolve(process.argv[2])

  const pluginRepository = await pluginRepoFactory(folderToBuild, {})

  await configureEventsToOutputEventToStdout(pluginRepository)

  const jobDispatcher = await pluginRepository.findPlugin({kind: 'jobDispatcher'})

  debug('building folder %s', folderToBuild)
  await jobDispatcher.dispatchJob({
    kind: 'repository',
    repository: folderToBuild,
    directory: folderToBuild,
    linkDependencies: true,
  })
})().catch(err => console.log(err.stack))

async function configureEventsToOutputEventToStdout(pluginRepository) {
  const events = await pluginRepository.findPlugin({kind: 'events'})

  await events.subscribe('START_JOB', ({job}) => {
    if (job.kind === 'repository') return

    console.log('####### Building', path.relative(job.artifactsDirectory, job.directory))
  })
}
