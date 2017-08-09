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

  const pluginRepository = await pluginRepoFactory(directoryToBuild, {directory: directoryToBuild})

  await configureEventsToOutputEventToStdout(pluginRepository)

  const jobDispatcher = await pluginRepository.findPlugin({
    kind: 'jobDispatcher',
  })

  const {
    filesChangedSinceLastBuild,
    fileChangesInCurrentRepo,
  } = await figureOutFilesChangedSinceLastBuild(directoryToBuild)

  let jobsToWaitFor
  if (!await jobDispatcher.hasAbortedJobs()) {
    if (filesChangedSinceLastBuild && filesChangedSinceLastBuild.length === 0) {
      console.error('Nothing to build')
      return
    }

    debug('building folder %s, with file changes %o', directoryToBuild, filesChangedSinceLastBuild)
    jobsToWaitFor = [
      await jobDispatcher.dispatchJob({
        kind: 'repository',
        repository: directoryToBuild,
        directory: directoryToBuild,
        linkDependencies: true,
        filesChangedSinceLastBuild,
      }),
    ]
  } else {
    debug('continuing previous build')
    jobsToWaitFor = await jobDispatcher.rerunAbortedJobs()
  }

  await waitForJobs(pluginRepository, jobsToWaitFor)

  await saveLastBuildInfo(directoryToBuild, await findChangesInCurrentRepo(directoryToBuild))
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

async function waitForJobs(pluginRepository, jobs) {
  debug('waiting for jobs %o', jobs.map(job => job.id))
  const events = await pluginRepository.findPlugin({kind: 'events'})
  const jobsThatAreStillWorking = new Set(jobs.map(job => job.id))

  await new Promise(async resolve => {
    await events.subscribe('END_JOB', ({job}) => {
      debug('job %s ended', job.id)
      jobsThatAreStillWorking.delete(job.id)

      if (jobsThatAreStillWorking.size === 0) {
        resolve()
      }
    })
  })
}
