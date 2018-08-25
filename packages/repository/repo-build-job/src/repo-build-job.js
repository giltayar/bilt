'use strict'
const {
  dependencyGraphSubsetToBuild,
  buildThatCanBeBuilt,
  createDependencyGraph,
} = require('@bilt/artifact-dependency-graph')
const debug = require('debug')('bilt:repo-build-job')

module.exports = ({plugins: [lastBuildInfo, events]}) => {
  return {
    async setupBuildSteps({state, awakenedFrom, job}) {
      const {force, uptoArtifacts, fromArtifacts, justBuildArtifacts, isRebuild} = job
      debug('running job repo-build-job')

      const {
        filesChangedSinceLastBuild,
        artifactBuildTimestamps,
      } = await determineInitialStateInformation(state, lastBuildInfo, job)

      if (awakenedFrom && awakenedFrom.result.success) {
        const artifact = awakenedFrom.job.artifact
        await lastBuildInfo.savePackageLastBuildInfo({
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
          filesChangedSinceLastBuild,
          force,
          artifactBuildTimestamps,
          uptoArtifacts,
          fromArtifacts,
          justBuildArtifacts,
          isRebuild,
        },
      }
    },
    getBuildSteps({
      buildContext: {
        state,
        awakenedFrom,
        initialAllArtifacts,
        linkDependencies,
        filesChangedSinceLastBuild,
        force,
        artifactBuildTimestamps,
        uptoArtifacts,
        fromArtifacts,
        justBuildArtifacts,
        isRebuild,
      },
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
        events.publish('STARTING_REPO_JOB', {
          artifactsToBeBuilt: Object.keys(state.dependencyGraph),
        })
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
        events.publish('FINISHING_REPO_JOB', {
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
        artifact,
        linkDependencies ? state.allArtifacts : undefined,
        isRebuild
          ? filesChangedSinceLastBuildInArtifact &&
            Object.keys(filesChangedSinceLastBuildInArtifact)
          : undefined,
        hasChangedDependencies,
      )

      debug('decided to run sub-job %o', artifactJob)
      return {
        state: {...state, ...{alreadyBuiltArtifacts}},
        jobs: [artifactJob].map(job => ({job, awaken: true})),
      }
    },
  }
}
module.exports.plugins = ['lastBuildInfo', 'events']

async function determineInitialStateInformation(state, lastBuildInfo, job) {
  if (state) return state

  const buildInfo = await lastBuildInfo.lastBuildInfo({artifacts: job.artifacts})
  const filesChangedSinceLastBuild = await lastBuildInfo.filesChangedSinceLastBuild({
    lastBuildInfo: buildInfo,
  })
  for (const {path: artifactPath} of job.artifacts) {
    await lastBuildInfo.savePrebuildBuildInfo({
      artifactPath,
      artifactFilesChangedSinceLastBuild: filesChangedSinceLastBuild[artifactPath],
    })
  }

  return {
    filesChangedSinceLastBuild,
    artifactBuildTimestamps: await lastBuildInfo.artifactBuildTimestamps({
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
  artifact,
  artifacts,
  artifactFilesChanged,
  hasChangedDependencies,
) => ({
  kind: artifact.type,
  artifact,
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild: artifactFilesChanged,
  hasChangedDependencies,
})
