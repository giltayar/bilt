'use strict'

const debug = require('debug')('bildit:bildit-here')
const pluginRepoFactory = require('@bildit/config-based-plugin-repository')
const path = require('path')
const {
  readLastBuildInfo,
  findChangesInCurrentRepo,
  calculateFilesChangedSinceLastBuild,
  saveLastBuildInfo,
} = require('./last-build-info')

main().catch(err => console.log(err.stack))

async function main() {
  const directoryToBuild = path.resolve(process.argv[2])
  const {
    filesChangedSinceLastBuild,
    fileChangesInCurrentRepo,
  } = await figureOutFilesChangedSinceLastBuild(directoryToBuild)

  if (filesChangedSinceLastBuild && filesChangedSinceLastBuild.length === 0) {
    console.error('Nothing to build')
    return
  }

  const pluginRepository = await pluginRepoFactory(directoryToBuild, {})

  await configureEventsToOutputEventToStdout(pluginRepository)

  const jobDispatcher = await pluginRepository.findPlugin({
    kind: 'jobDispatcher',
  })

  debug('building folder %s, with file changes %o', directoryToBuild, filesChangedSinceLastBuild)
  await jobDispatcher.dispatchJob({
    kind: 'repository',
    repository: directoryToBuild,
    directory: directoryToBuild,
    linkDependencies: true,
    filesChangedSinceLastBuild,
  })

  await saveLastBuildInfo(directoryToBuild, fileChangesInCurrentRepo)
}

async function configureEventsToOutputEventToStdout(pluginRepository) {
  const events = await pluginRepository.findPlugin({kind: 'events'})

  await events.subscribe('START_JOB', ({job}) => {
    if (job.kind === 'repository') return

    console.log('####### Building', path.relative(job.artifactsDirectory, job.directory))
  })
}

async function figureOutFilesChangedSinceLastBuild(directory) {
  const lastBuildInfo = await readLastBuildInfo(directory)

  const fileChangesInCurrentRepo = await findChangesInCurrentRepo(directory)

  const filesChangedSinceLastBuild = lastBuildInfo
    ? await calculateFilesChangedSinceLastBuild(directory, lastBuildInfo, fileChangesInCurrentRepo)
    : undefined

  return {filesChangedSinceLastBuild, fileChangesInCurrentRepo}
}
