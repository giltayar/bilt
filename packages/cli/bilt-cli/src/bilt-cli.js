'use strict'
const path = require('path')
const debug = require('debug')('bilt:bilt-cli')
const pluginImport = require('plugin-import')
const cosmiConfig = require('cosmiconfig')
const artifactFinder = require('@bilt/artifact-finder')
const defaultbiltConfig = require('./default-biltrc')

const {
  readLastBuildInfo,
  findChangesInCurrentRepo,
  calculateFilesChangedSinceLastBuild,
  saveLastBuildInfo,
} = require('./last-build-info')

module.exports = async function(directoryToBuild, repository) {
  const isRemoteRepo = repository
  const pimport = await createPimport(isRemoteRepo, directoryToBuild, repository)
  try {
    await configureEventsToOutputEventToStdout(pimport)

    const jobDispatcher = await pimport('jobDispatcher')

    const {filesChangedSinceLastBuild} = await figureOutFilesChangedSinceLastBuild(directoryToBuild)
    const jobsToWaitFor = await runRepoBuildJob(
      pimport,
      directoryToBuild,
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

async function createPimport(isRemoteRepo, directoryToBuild, repository) {
  debug('loading configuration')
  const {config: buildConfig, filepath} = await cosmiConfig('bilt', {
    rcExtensions: true,
  }).load(directoryToBuild)

  return pluginImport(
    [
      defaultbiltConfig.plugins,
      buildConfig.plugins,
      {
        'agent:docker': {
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
}

async function configureEventsToOutputEventToStdout(pimport) {
  const events = await pimport('events')

  await events.subscribe('START_JOB', ({job}) => {
    if (job.kind === 'repository') return

    console.log('####### Building', job.artifact.path || job.directory)
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

async function runRepoBuildJob(
  pimport,
  directoryToBuild,
  repository,
  isRemoteRepo,
  jobDispatcher,
  filesChangedSinceLastBuild,
) {
  if (filesChangedSinceLastBuild && filesChangedSinceLastBuild.length === 0) {
    console.error('Nothing to build')
    return
  }
  debug('fetching artifacts')
  const artifacts = await (await artifactFinder()).findArtifacts(directoryToBuild)

  debug('building with file changes %o', filesChangedSinceLastBuild)
  return [
    await jobDispatcher.dispatchJob({
      kind: 'repository',
      repository,
      artifacts,
      linkDependencies: true,
      filesChangedSinceLastBuild,
    }),
  ]
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
