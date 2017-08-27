'use strict'

const path = require('path')
const fs = require('fs')
const {promisify: p} = require('util')
const debug = require('debug')('bildit:bildit-here')
const pluginRepoFactory = require('@bildit/config-based-plugin-repository')
const {
  readLastBuildInfo,
  findChangesInCurrentRepo,
  calculateFilesChangedSinceLastBuild,
  saveLastBuildInfo,
} = require('./last-build-info')

process.on('unhandledRejection', err => {
  console.log(err.stack)
  process.exit(2)
})

main().catch(err => console.log(err.stack))

async function main() {
  const directoryToBuild = path.resolve(process.argv[2])

  const pluginRepository = await createPluginRepository(directoryToBuild)
  await configureEventsToOutputEventToStdout(pluginRepository)

  const jobDispatcher = await pluginRepository.findPlugin('jobDispatcher')

  const {filesChangedSinceLastBuild} = await figureOutFilesChangedSinceLastBuild(directoryToBuild)

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
  const events = await pluginRepository.findPlugin('events')

  await events.subscribe('START_JOB', ({job}) => {
    if (job.kind === 'repository') return

    console.log('####### Building', job.artifactPath || job.directory)
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
  const events = await pluginRepository.findPlugin('events')
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

async function createPluginRepository(directoryToBuild) {
  const defaultConfig = await JSON.parse(
    await p(fs.readFile)(path.join(__dirname, 'default-bilditrc.json')),
  )

  return await pluginRepoFactory({
    directory: directoryToBuild,
    defaultConfig,
  })
}
