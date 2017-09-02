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
  console.log(err.stack || err)
  process.exit(2)
})

main().catch(err => console.log(err.stack || err))

async function main() {
  const isRemoteRepo = process.argv[2].startsWith('http') || process.argv[2].startsWith('git@')
  const directoryToBuild = !isRemoteRepo ? path.resolve(process.argv[2]) : undefined
  const config = !directoryToBuild ? path.resolve(process.argv[3]) : directoryToBuild
  const repository = isRemoteRepo ? process.argv[2] : directoryToBuild

  const pluginRepository = await createPluginRepository(config)
  try {
    await configureEventsToOutputEventToStdout(pluginRepository)

    const jobDispatcher = await pluginRepository.findPlugin('jobDispatcher')

    const {filesChangedSinceLastBuild} = directoryToBuild
      ? await figureOutFilesChangedSinceLastBuild(directoryToBuild)
      : {}

    const jobsToWaitFor = await runJobs(
      repository,
      isRemoteRepo,
      jobDispatcher,
      filesChangedSinceLastBuild,
    )

    await waitForJobs(pluginRepository, jobsToWaitFor)

    if (directoryToBuild) {
      await saveLastBuildInfo(directoryToBuild, await findChangesInCurrentRepo(directoryToBuild))
    }
  } finally {
    debug('finalizing plugins')
    await pluginRepository.finalize()
  }
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

async function runJobs(repository, isRemoteRepo, jobDispatcher, filesChangedSinceLastBuild) {
  if (isRemoteRepo || !await jobDispatcher.hasAbortedJobs()) {
    if (filesChangedSinceLastBuild && filesChangedSinceLastBuild.length === 0) {
      console.error('Nothing to build')
      return
    }

    debug('building folder %s, with file changes %o', repository, filesChangedSinceLastBuild)
    return [
      await jobDispatcher.dispatchJob({
        kind: 'repository',
        repository,
        linkDependencies: true,
        filesChangedSinceLastBuild,
      }),
    ]
  } else {
    debug('continuing previous build')
    return await jobDispatcher.rerunAbortedJobs()
  }
}

async function waitForJobs(pluginRepository, jobs) {
  debug('waiting for jobs %o', (jobs || []).map(job => job.id))
  const events = await pluginRepository.findPlugin('events')
  const jobsThatAreStillWorking = new Set((jobs || []).map(job => job.id))

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
