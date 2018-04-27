'use strict'
const path = require('path')
const debug = require('debug')('bilt:bilt-cli')
const pluginImport = require('plugin-import')
const cosmiConfig = require('cosmiconfig')
const flatten = require('lodash.flatten')
const artifactFinder = require('@bilt/artifact-finder')
const defaultbiltConfig = require('./default-biltrc')

async function buildHere(directoryToBuild, {upto, from, justBuild, force, repository} = {}) {
  const isRemoteRepo = repository
  const pimport = await createPimport(isRemoteRepo, directoryToBuild, repository)
  try {
    await configureEventsToOutputEventToStdout(pimport)

    const jobDispatcher = await pimport('jobDispatcher')

    const jobsToWaitFor = await runRepoBuildJob({
      directoryToBuild,
      repository,
      jobDispatcher,
      upto,
      from,
      justBuild,
      force,
    })

    await waitForJobs(pimport, jobsToWaitFor)
  } finally {
    debug('finalizing plugins')
    await pimport.finalize()
  }
}

async function createPimport(isRemoteRepo, directoryToBuild, repository) {
  debug('loading configuration', directoryToBuild)
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

async function runRepoBuildJob({
  directoryToBuild,
  repository,
  jobDispatcher,
  upto,
  from,
  justBuild,
  force,
}) {
  debug('fetching artifacts')
  const artifacts = await (await artifactFinder()).findArtifacts(directoryToBuild)

  if (!upto && !from && !justBuild) {
    from = artifacts.map(a => a.name)
  }

  return [
    await jobDispatcher.dispatchJob({
      kind: 'repository',
      repository,
      artifacts,
      uptoArtifacts: normalizeArtifacts(upto, artifacts, directoryToBuild),
      fromArtifacts: normalizeArtifacts(from, artifacts, directoryToBuild),
      justBuildArtifacts: normalizeArtifacts(justBuild, artifacts, directoryToBuild),
      linkDependencies: true,
      force,
    }),
  ]
}

function normalizeArtifacts(artifactsOrDirs, artifacts, directoryToBuild) {
  if (!artifactsOrDirs) return artifactsOrDirs

  return flatten(
    artifactsOrDirs.map(artifactNameOrDir => {
      if (artifactNameOrDir.startsWith('.') || artifactNameOrDir.startsWith('/')) {
        const pathOfArtifact = path.resolve(process.cwd(), artifactNameOrDir)
        const foundArtifacts = artifacts.filter(artifact =>
          pathOfArtifact.startsWith(path.resolve(directoryToBuild, artifact.path)),
        )
        if (foundArtifacts.length === 0)
          throw new Error(`could not find artifact "${artifactNameOrDir}"`)

        return foundArtifacts.map(a => a.name)
      } else {
        const foundArtifact = artifacts.find(artifact => artifact.name === artifactNameOrDir)
        if (!foundArtifact) throw new Error(`could not find artifact "${artifactNameOrDir}"`)

        return foundArtifact.name
      }
    }),
  )
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

module.exports = buildHere
