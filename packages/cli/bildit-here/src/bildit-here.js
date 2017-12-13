'use strict'

const path = require('path')
const fs = require('fs')
const {promisify: p} = require('util')
const debug = require('debug')('bildit:bildit-here')
const pluginImport = require('plugin-import')
const cosmiConfig = require('cosmiconfig')

const {
  readLastBuildInfo,
  findChangesInCurrentRepo,
  calculateFilesChangedSinceLastBuild,
  saveLastBuildInfo,
} = require('./last-build-info')

module.exports = async function(repository, configFile) {
  const isRemoteRepo =
    repository.startsWith('http:') || repository.startsWith('ssh:') || repository.startsWith('git@')

  const directoryToBuild = isRemoteRepo ? undefined : path.resolve(repository)

  const pimport = await createPimport(isRemoteRepo, directoryToBuild, repository, configFile)
  try {
    await configureEventsToOutputEventToStdout(pimport)

    const jobDispatcher = await pimport('jobDispatcher')

    const {filesChangedSinceLastBuild} = !isRemoteRepo
      ? await figureOutFilesChangedSinceLastBuild(directoryToBuild)
      : {}

    const jobsToWaitFor = await runJobs(
      repository,
      isRemoteRepo,
      jobDispatcher,
      filesChangedSinceLastBuild,
    )

    await waitForJobs(pimport, jobsToWaitFor)

    if (!isRemoteRepo) {
      await saveLastBuildInfo(directoryToBuild, await findChangesInCurrentRepo(directoryToBuild))
    }
  } finally {
    debug('finalizing plugins')
    await pimport.finalize()
  }
}

async function createPimport(isRemoteRepo, directoryToBuild, repository, configFile) {
  debug('loading configuration')
  const {config: buildConfig, filepath} = await cosmiConfig('bildit', {
    configPath: isRemoteRepo ? configFile : undefined,
    rcExtensions: true,
  }).load(isRemoteRepo ? undefined : directoryToBuild)

  const defaultBilditConfig = await JSON.parse(
    await p(fs.readFile)(path.join(__dirname, 'default-bilditrc.json')),
  )

  return pluginImport(
    [
      defaultBilditConfig.plugins,
      buildConfig.plugins,
      {
        'agent:docker': {
          directory: isRemoteRepo ? undefined : directoryToBuild,
        },
        'agent:repository': {
          directory: isRemoteRepo ? undefined : directoryToBuild,
        },
        'agent:npm': {
          directory: isRemoteRepo ? undefined : directoryToBuild,
        },
        repositoryFetcher: {
          repository: isRemoteRepo ? repository : undefined,
          directory: isRemoteRepo ? undefined : directoryToBuild,
        },
      },
    ],
    {
      baseDirectory: path.dirname(filepath),
    },
  )

  function removePlugins(obj) {
    const copy = {...obj}

    delete copy.plugins

    return copy
  }
}

async function configureEventsToOutputEventToStdout(pimport) {
  const events = await pimport('events')

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

    debug('building with file changes %o', filesChangedSinceLastBuild)
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

async function waitForJobs(pimport, jobs) {
  debug('waiting for jobs %o', (jobs || []).map(job => job.id))
  const events = await pimport('events')
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
