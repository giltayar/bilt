'use strict'
const {
  dependencyGraphSubsetToBuild,
  buildThatCanBeBuilt,
  createDependencyGraph,
  dependencyGraphBuildList,
} = require('@bilt/artifact-dependency-graph')
const debug = require('debug')('bilt:repo-build-job')
const {publish} = require('@bilt/in-memory-events')
const {
  savePackageLastBuildInfo,
  savePrebuildBuildInfo,
  lastBuildInfo,
  artifactBuildTimestamps,
  filesChangedSinceLastBuild,
} = require('@bilt/last-build-info')

async function setupBuildSteps({state, awakenedFrom, job}) {
  const {
    force,
    uptoArtifacts,
    fromArtifacts,
    justBuildArtifacts,
    isRebuild,
    isDryRun,
    repositoryDirectory,
  } = job
  debug('running job repo-build-job')

  const {
    filesChangedSinceLastBuild,
    artifactBuildTimestamps,
  } = await determineInitialStateInformation(state, job)

  if (awakenedFrom && awakenedFrom.result.success) {
    const artifact = awakenedFrom.job.artifact
    debug('saving package last build info for artifact %s', artifact.name)
    await savePackageLastBuildInfo({
      repositoryDirectory,
      artifactPath: artifact.path,
      artifactFilesChangedSinceLastBuild: filesChangedSinceLastBuild[artifact.path],
    })
  }

  return {
    buildContext: {
      state,
      awakenedFrom,
      initialAllArtifacts: job.artifacts,
      linkDependencies: job.linkDependencies,
      repositoryDirectory,
      filesChangedSinceLastBuild,
      force,
      artifactBuildTimestamps,
      uptoArtifacts,
      fromArtifacts,
      justBuildArtifacts,
      isRebuild,
      isDryRun,
    },
  }
}
function getJobsToDispatch({
  buildContext: {
    state,
    awakenedFrom,
    initialAllArtifacts,
    linkDependencies,
    repositoryDirectory,
    filesChangedSinceLastBuild,
    force,
    artifactBuildTimestamps,
    uptoArtifacts,
    fromArtifacts,
    justBuildArtifacts,
    isRebuild,
    isDryRun,
  },
  events,
}) {
  if (!state) {
    debug('files changed: %o', filesChangedSinceLastBuild)
  }
  state = state || {
    allArtifacts: initialAllArtifacts,
    filesChangedSinceLastBuild,
    dependencyGraph: dependencyGraphSubsetToBuild({
      dependencyGraph: createDependencyGraph(initialAllArtifacts),
      changedArtifacts: artifactsFromChanges(
        initialAllArtifacts,
        filesChangedSinceLastBuild,
        force,
      ),
      artifactBuildTimestamps,
      fromArtifacts,
      uptoArtifacts,
      justBuildArtifacts,
    }),
    alreadyBuiltArtifacts: [],
  }
  if (!awakenedFrom) {
    publish(events, 'STARTING_REPO_JOB', {
      artifactsToBeBuilt: dependencyGraphBuildList(state.dependencyGraph),
    })
    if (isDryRun) return {}
  }

  const alreadyBuiltArtifacts = determineArtifactsThatAreAlreadyBuilt(awakenedFrom, state)
  const {build: artifactToBuild, hasChangedDependencies} =
    buildThatCanBeBuilt(state.dependencyGraph, alreadyBuiltArtifacts) || {}

  debug(
    'artifactToBuild: %o, determined from graph: %o and alreadybuilt: %o',
    artifactToBuild,
    state.dependencyGraph,
    alreadyBuiltArtifacts,
  )

  if (!artifactToBuild) {
    publish(events, 'FINISHING_REPO_JOB', {
      alreadyBuiltArtifacts,
    })
    return {}
  }

  debug('building artifact %s', artifactToBuild)
  const artifact = state.allArtifacts.find(a => a.name === artifactToBuild)
  const filesChangedSinceLastBuildInArtifact = force
    ? undefined
    : state.filesChangedSinceLastBuild[artifact.path]
  const artifactJob = createJobFromArtifact(
    repositoryDirectory,
    artifact,
    linkDependencies ? state.allArtifacts : undefined,
    isRebuild
      ? filesChangedSinceLastBuildInArtifact && Object.keys(filesChangedSinceLastBuildInArtifact)
      : undefined,
    hasChangedDependencies,
  )

  debug('decided to run sub-job %o', artifactJob)
  return {
    state: {...state, ...{alreadyBuiltArtifacts}},
    jobs: [artifactJob].map(job => ({job, awaken: true})),
  }
}

async function determineInitialStateInformation(state, job) {
  if (state) return state

  const {repositoryDirectory} = job

  const buildInfo = await lastBuildInfo({repositoryDirectory, artifacts: job.artifacts})
  const filesChangedSinceLastBuildValue = await filesChangedSinceLastBuild({
    repositoryDirectory,
    lastBuildInfo: buildInfo,
  })
  for (const {path: artifactPath, name} of job.artifacts) {
    debug('saving prebuild info for artifact %s', name)
    await savePrebuildBuildInfo({repositoryDirectory, artifactPath})
  }

  return {
    filesChangedSinceLastBuild: filesChangedSinceLastBuildValue,
    artifactBuildTimestamps: await artifactBuildTimestamps({
      lastBuildInfo: buildInfo,
    }),
  }
}

function determineArtifactsThatAreAlreadyBuilt(awakenedFrom, state) {
  return awakenedFrom && awakenedFrom.result.success
    ? state.alreadyBuiltArtifacts.concat(awakenedFrom.job.artifact.name)
    : awakenedFrom && !awakenedFrom.result.success
      ? state.alreadyBuiltArtifacts.concat(
          Object.keys(
            dependencyGraphSubsetToBuild({
              dependencyGraph: state.dependencyGraph,
              changedArtifacts: [awakenedFrom.job.artifact.name],
              fromArtifacts: [awakenedFrom.job.artifact.name],
            }),
          ),
        )
      : []
}

function artifactsFromChanges(artifacts, filesChangedSinceLastBuild, force) {
  return artifacts
    .filter(
      artifact =>
        force ||
        filesChangedSinceLastBuild[artifact.path] === undefined ||
        Object.keys(filesChangedSinceLastBuild[artifact.path]).length > 0,
    )
    .map(artifact => artifact.name)
}

const createJobFromArtifact = (
  repositoryDirectory,
  artifact,
  artifacts,
  artifactFilesChanged,
  hasChangedDependencies,
) => ({
  repositoryDirectory,
  kind: artifact.type,
  artifact,
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild: artifactFilesChanged,
  hasChangedDependencies,
})

module.exports = {
  setupBuildSteps,
  getJobsToDispatch,
}
