'use strict'
const path = require('path')
const {
  artifactsToBuildFromChange,
  buildsThatCanBeBuilt,
  createDependencyGraph,
} = require('@bildit/artifact-dependency-graph')
const debug = require('debug')('bildit:repo-build-job')

module.exports = ({plugins: [binaryRunner, repositoryFetcher]}) => {
  return {
    async setupBuildSteps({agentInstance, state, awakenedFrom, job}) {
      debug('running job repo-build-job')

      const {directory} = await repositoryFetcher.fetchRepository({agentInstance})

      const initialAllArtifacts = awakenedFrom
        ? undefined
        : await findArtifactsInRepository(binaryRunner, agentInstance, directory)

      return {
        buildContext: {
          state,
          awakenedFrom,
          initialAllArtifacts,
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

async function findArtifactsInRepository(binaryRunner, agentInstance, directory) {
  if (process.env.USE_LOCAL_ARTIFACT_FINDER) {
    return await (await require('@bildit/artifact-finder')()).findArtifacts(directory)
  }
  return JSON.parse(
    (await binaryRunner.run({
      binary: '@bildit/artifact-finder',
      executeCommandArg: {
        agentInstance,
        command: ['artifact-finder', directory],
        returnOutput: true,
      },
    })).stdout,
  )
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

module.exports.plugins = ['binaryRunner:npm', 'repositoryFetcher']

const createJobFromArtifact = (artifact, artifacts, filesChangedSinceLastBuild) => ({
  kind: artifact.type,
  artifact,
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild:
    filesChangedSinceLastBuild &&
    filesChangedSinceLastBuild.map(f => path.relative(artifact.path, f)),
})
