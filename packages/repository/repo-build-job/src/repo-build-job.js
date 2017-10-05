'use strict'

const debug = require('debug')('bildit:repo-build-job')
const path = require('path')

module.exports = ({plugins: [binaryRunner, repositoryFetcher]}) => {
  return {
    async setupBuildSteps({agentInstance, state, awakenedFrom}) {
      debug('running job repo-build-job')

      const {directory} = await repositoryFetcher.fetchRepository({agentInstance})

      const text = awakenedFrom
        ? undefined
        : await binaryRunner.run({
            binary: '@bildit/artifact-finder',
            executeCommandArg: {
              agentInstance,
              command: ['artifact-finder', directory],
              returnOutput: true,
            },
          })
      const initialAllArtifacts = awakenedFrom ? undefined : JSON.parse(text)

      return {howToBuild: {state, awakenedFrom, initialAllArtifacts}}
    },
    getBuildSteps({
      howToBuild: {state, awakenedFrom, initialAllArtifacts},
      job: {linkDependencies, filesChangedSinceLastBuild},
    }) {
      const remainingArtifactsToBuild = initialAllArtifacts
        ? initialAllArtifacts.filter(
            artifactToBuild =>
              !filesChangedSinceLastBuild ||
              filesChangedSinceLastBuild.find(file => file.startsWith(artifactToBuild.path + '/')),
          )
        : state.artifactsToBuild.filter(
            artifact => !awakenedFrom || awakenedFrom.job.artifact !== artifact.artifact,
          )

      state = state || {allArtifacts: initialAllArtifacts}

      debug('remaining to build %o', remainingArtifactsToBuild.map(artifact => artifact.artifact))

      if (!remainingArtifactsToBuild || remainingArtifactsToBuild.length === 0) {
        return {}
      }
      const artifactToBuild = remainingArtifactsToBuild[0]

      debug('building artifact %o', artifactToBuild.artifact)

      const changedFiles =
        filesChangedSinceLastBuild &&
        filesChangedSinceLastBuild.filter(file => file.startsWith(artifactToBuild.path + '/'))

      if (!changedFiles || changedFiles.length > 0) {
        const artifactJob = createJobFromArtifact(
          artifactToBuild,
          linkDependencies ? state.allArtifacts : undefined,
          changedFiles,
        )

        debug('decided to run sub-job %o', artifactJob)

        return {
          state: {
            ...state,
            ...{artifactsToBuild: remainingArtifactsToBuild},
          },
          jobs: [artifactJob].map(job => ({job, awaken: true})),
        }
      }
    },
  }
}

module.exports.plugins = ['binaryRunner:npm', 'repositoryFetcher']

const createJobFromArtifact = (artifact, artifacts, changedFiles) => ({
  kind: artifact.type,
  artifact: artifact.artifact,
  artifactPath: artifact.path,
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild:
    changedFiles && changedFiles.map(f => path.relative(artifact.path, f)),
})
