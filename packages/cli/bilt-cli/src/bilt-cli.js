'use strict'
const path = require('path')
const debug = require('debug')('bilt:bilt-cli')
const pluginImport = require('plugin-import')
const cosmiConfig = require('cosmiconfig')
const artifactFinder = require('@bilt/artifact-finder')
const defaultbiltConfig = require('./default-biltrc')

module.exports = async function(directoryToBuild, repository) {
  const isRemoteRepo = repository
  const pimport = await createPimport(isRemoteRepo, directoryToBuild, repository)
  try {
    await configureEventsToOutputEventToStdout(pimport)

    const jobDispatcher = await pimport('jobDispatcher')

    const jobsToWaitFor = await runRepoBuildJob(
      pimport,
      directoryToBuild,
      repository,
      isRemoteRepo,
      jobDispatcher,
    )

    await waitForJobs(pimport, jobsToWaitFor)
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

async function runRepoBuildJob(pimport, directoryToBuild, repository, isRemoteRepo, jobDispatcher) {
  debug('fetching artifacts')
  const artifacts = await (await artifactFinder()).findArtifacts(directoryToBuild)

  return [
    await jobDispatcher.dispatchJob({
      kind: 'repository',
      repository,
      artifacts,
      linkDependencies: true,
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
