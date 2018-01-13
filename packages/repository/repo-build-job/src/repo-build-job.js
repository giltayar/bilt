'use strict'
const path = require('path')
const {
  artifactsToBuildFromChange,
  buildsThatCanBeBuilt,
  createDependencyGraph,
} = require('@bilt/artifact-dependency-graph')
const debug = require('debug')('bilt:repo-build-job')

module.exports = () => {
  return {
    async setupBuildSteps({state, awakenedFrom, job}) {
      debug('running job repo-build-job')

      return {
        buildContext: {
          state,
          awakenedFrom,
          initialAllArtifacts: job.artifacts,
          linkDependencies: job.linkDependencies,
          filesChangedSinceLastBuild: job.filesChangedSinceLastBuild,
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
      },
    }) {
      state = state || {
        allArtifacts: initialAllArtifacts,
        dependencyGraph: artifactsToBuildFromChange(
          createDependencyGraph(initialAllArtifacts),
          artifactsFromChanges(initialAllArtifacts, filesChangedSinceLastBuild),
        ),
        alreadyBuiltArtifacts: [],
      }
      const alreadyBuiltArtifacts = determineArtifactsThatAreAlreadyBuilt(awakenedFrom, state)
      const artifactsToBuild = buildsThatCanBeBuilt(state.dependencyGraph, alreadyBuiltArtifacts)

      if (!artifactsToBuild || artifactsToBuild.length === 0) {
        return {}
      }
      const artifactToBuild = artifactsToBuild[0]

      debug('building artifact %s', artifactToBuild)
      const artifactJob = createJobFromArtifact(
        state.allArtifacts.find(a => a.name === artifactToBuild),
        linkDependencies ? state.allArtifacts : undefined,
        filesChangedSinceLastBuild,
      )

      debug('decided to run sub-job %o', artifactJob)
      return {
        state: {...state, ...{alreadyBuiltArtifacts}},
        jobs: [artifactJob].map(job => ({job, awaken: true})),
      }
    },
  }
}

function determineArtifactsThatAreAlreadyBuilt(awakenedFrom, state) {
  return awakenedFrom && awakenedFrom.result.success
    ? state.alreadyBuiltArtifacts.concat(awakenedFrom.job.artifact.name)
    : awakenedFrom && !awakenedFrom.result.success
      ? state.alreadyBuiltArtifacts.concat(
          Object.keys(
            artifactsToBuildFromChange(state.dependencyGraph, [awakenedFrom.job.artifact.name]),
          ),
        )
      : []
}

function artifactsFromChanges(artifacts, filesChangedSinceLastBuild) {
  return artifacts
    .filter(
      artifact =>
        !filesChangedSinceLastBuild ||
        filesChangedSinceLastBuild.find(file => file.startsWith(artifact.path + '/')),
    )
    .map(artifact => artifact.name)
}

const createJobFromArtifact = (artifact, artifacts, filesChangedSinceLastBuild) => ({
  kind: artifact.type,
  artifact,
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild:
    filesChangedSinceLastBuild &&
    filesChangedSinceLastBuild.map(f => path.relative(artifact.path, f)),
})
