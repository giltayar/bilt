'use strict'
const {
  dependencyGraphSubsetToBuild,
  buildsThatCanBeBuilt,
  createDependencyGraph,
} = require('@bilt/artifact-dependency-graph')
const debug = require('debug')('bilt:repo-build-job')

module.exports = ({plugins: [lastBuildInfo]}) => {
  return {
    async setupBuildSteps({state, awakenedFrom, job}) {
      const {force, uptoArtifacts, fromArtifacts, justBuildArtifacts} = job
      debug('running job repo-build-job')

      const filesChangedSinceLastBuild = force
        ? undefined
        : (state && state.filesChangedSinceLastBuild) ||
          (await lastBuildInfo.filesChangedSinceLastBuild({artifacts: job.artifacts}))

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
          uptoArtifacts,
          fromArtifacts,
          justBuildArtifacts,
          force,
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
        uptoArtifacts,
        fromArtifacts,
        justBuildArtifacts,
        force,
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
          fromArtifacts: force ? initialAllArtifacts : fromArtifacts,
          uptoArtifacts,
          justBuildArtifacts,
        }),
        alreadyBuiltArtifacts: [],
      }
      const alreadyBuiltArtifacts = determineArtifactsThatAreAlreadyBuilt(awakenedFrom, state)
      const artifactsToBuild = buildsThatCanBeBuilt(state.dependencyGraph, alreadyBuiltArtifacts)

      if (!artifactsToBuild || artifactsToBuild.length === 0) {
        return {}
      }
      const artifactToBuild = artifactsToBuild[0]

      debug('building artifact %s', artifactToBuild)
      const artifact = state.allArtifacts.find(a => a.name === artifactToBuild)
      const artifactJob = createJobFromArtifact(
        artifact,
        linkDependencies ? state.allArtifacts : undefined,
        Object.keys(state.filesChangedSinceLastBuild[artifact.path] || {}),
      )

      debug('decided to run sub-job %o', artifactJob)
      return {
        state: {...state, ...{alreadyBuiltArtifacts}},
        jobs: [artifactJob].map(job => ({job, awaken: true})),
      }
    },
  }
}
module.exports.plugins = ['lastBuildInfo']

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
