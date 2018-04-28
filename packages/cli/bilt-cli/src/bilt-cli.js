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

  let nothingToBuild = false
  await events.subscribe('STARTING_REPO_JOB', ({artifactsToBeBuilt}) => {
    if (artifactsToBeBuilt.length === 0) {
      console.log('#### Nothing to build')
      nothingToBuild = true
    } else {
      console.log('####### Building artifacts: %s', artifactsToBeBuilt.join(','))
    }
  })

  await events.subscribe('FINISHING_REPO_JOB', ({alreadyBuiltArtifacts}) => {
    if (!nothingToBuild) {
      console.log('####### Built artifacts: %s', alreadyBuiltArtifacts.join(','))
    }
    nothingToBuild
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

function normalizeArtifacts(artifactsOrDirsToBuild, artifacts, directoryToBuild) {
  if (!artifactsOrDirsToBuild) return artifactsOrDirsToBuild

  return flatten(
    artifactsOrDirsToBuild.map(artifactNameOrDirToBuild => {
      if (artifactNameOrDirToBuild.startsWith('.') || artifactNameOrDirToBuild.startsWith('/')) {
        const pathOfArtifact = path.resolve(directoryToBuild, artifactNameOrDirToBuild)
        debug('looking for artifacts under %s', pathOfArtifact)
        const foundArtifacts = artifacts.filter(artifact =>
          path.resolve(directoryToBuild, artifact.path).startsWith(pathOfArtifact),
        )
        if (foundArtifacts.length === 0)
          throw new Error(`could not find artifact "${artifactNameOrDirToBuild}"`)

        return foundArtifacts.map(a => a.name)
      } else {
        const foundArtifact = artifacts.find(artifact => artifact.name === artifactNameOrDirToBuild)
        if (!foundArtifact) throw new Error(`could not find artifact "${artifactNameOrDirToBuild}"`)

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
