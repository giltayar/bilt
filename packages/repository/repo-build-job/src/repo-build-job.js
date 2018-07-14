'use strict'
const {
  dependencyGraphSubsetToBuild,
  buildsThatCanBeBuilt,
  createDependencyGraph,
} = require('@bilt/artifact-dependency-graph')
const debug = require('debug')('bilt:repo-build-job')

module.exports = ({plugins: [lastBuildInfo, events]}) => {
  return {
    async setupBuildSteps({state, awakenedFrom, job}) {
      const {force, uptoArtifacts, fromArtifacts, justBuildArtifacts} = job
      debug('running job repo-build-job')

      const {
        filesChangedSinceLastBuild,
        artifactBuildTimestamps,
      } = await determineInitialStateInformation(force, state, lastBuildInfo, job)

      if (awakenedFrom && awakenedFrom.result.success) {
        const artifact = awakenedFrom.job.artifact
        await lastBuildInfo.savePackageLastBuildInfo({
          artifactPath: artifact.path,
          rartifactFilesChangedSinceLastBuild: filesChangedSinceLastBuild[artifact.path],
        })
      }

      return {
        buildContext: {
          state,
          awakenedFrom,
          initialAllArtifacts: job.artifacts,
          linkDependencies: job.linkDependencies,
          filesChangedSinceLastBuild,
          artifactBuildTimestamps,
          uptoArtifacts,
          fromArtifacts,
          justBuildArtifacts,
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
        artifactBuildTimestamps,
        uptoArtifacts,
        fromArtifacts,
        justBuildArtifacts,
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
          changedArtifacts: artifactsFromChanges(initialAllArtifacts, filesChangedSinceLastBuild),
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
      const artifactsToBuild = buildsThatCanBeBuilt(state.dependencyGraph, alreadyBuiltArtifacts)
      debug(
        'artifactsToBuild: %o, determined from graph: %o and alreadybuilt: %o',
        artifactsToBuild,
        state.dependencyGraph,
        alreadyBuiltArtifacts,
      )

      if (!artifactsToBuild || artifactsToBuild.length === 0) {
        events.publish('FINISHING_REPO_JOB', {
          alreadyBuiltArtifacts,
        })
        return {}
      }
      const artifactToBuild = artifactsToBuild[0]

      debug('building artifact %s', artifactToBuild)
      const artifact = state.allArtifacts.find(a => a.name === artifactToBuild)
      const filesChangedSinceLastBuildInArtifact = state.filesChangedSinceLastBuild[artifact.path]
      const artifactJob = createJobFromArtifact(
        artifact,
        linkDependencies ? state.allArtifacts : undefined,
        filesChangedSinceLastBuildInArtifact && Object.keys(filesChangedSinceLastBuildInArtifact),
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

async function determineInitialStateInformation(force, state, lastBuildInfo, job) {
  if (force) return {filesChangedSinceLastBuild: {}, artifactBuildTimestamps: {}}
  if (state) return state

  const buildInfo = await lastBuildInfo.lastBuildInfo({artifacts: job.artifacts})

  return {
    filesChangedSinceLastBuild: await lastBuildInfo.filesChangedSinceLastBuild({
      lastBuildInfo: buildInfo,
    }),
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

function artifactsFromChanges(artifacts, filesChangedSinceLastBuild) {
  return artifacts
    .filter(
      artifact =>
        filesChangedSinceLastBuild[artifact.path] === undefined ||
        Object.keys(filesChangedSinceLastBuild[artifact.path]).length > 0,
    )
    .map(artifact => artifact.name)
}

const createJobFromArtifact = (artifact, artifacts, artifactFilesChanged) => ({
  kind: artifact.type,
  artifact,
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild: artifactFilesChanged,
})
