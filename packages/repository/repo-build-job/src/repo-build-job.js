'use strict'

const debug = require('debug')('bildit:repo-build-job')
const path = require('path')

module.exports = async ({pimport}) => {
  const binaryRunner = await pimport('binaryRunner:npm')
  const repositoryFetcher = await pimport('repositoryFetcher')

  return {
    async setupBuildSteps({job, agentInstance, state, awakenedFrom}) {
      debug('running job repo-build-job')
      const {filesChangedSinceLastBuild} = job

      const {directory} = await repositoryFetcher.fetchRepository({agentInstance})

      const newState =
        state || (await getInitialState(agentInstance, directory, filesChangedSinceLastBuild))

      return {howToBuild: {state: newState, awakenedFrom}}
    },
    getBuildSteps({howToBuild: {state, awakenedFrom}, job}) {
      const {artifactsToBuild} = state
      const {linkDependencies, filesChangedSinceLastBuild} = job
      debug('found artifacts %o', artifactsToBuild)
      const remainingArtifactsToBuild = state.artifactsToBuild.filter(
        artifact => !awakenedFrom || awakenedFrom.job.artifact !== artifact.artifact,
      )
      debug('remaining to build %o', remainingArtifactsToBuild.map(artifact => artifact.artifact))

      if (!remainingArtifactsToBuild || remainingArtifactsToBuild.length === 0) {
        return
      }
      const artifactToBuild = remainingArtifactsToBuild[0]

      debug('building artifact %o', artifactToBuild.artifact)

      const changedFiles =
        filesChangedSinceLastBuild &&
        filesChangedSinceLastBuild.filter(file => file.startsWith(artifactToBuild.path + '/'))

      if (!changedFiles || changedFiles.length > 0) {
        const artifactJob = createJobFromArtifact(
          artifactToBuild,
          state.repository,
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

  async function getInitialState(agentInstance, directory, filesChangedSinceLastBuild) {
    debug('files changed %o. Searching for artifacts', filesChangedSinceLastBuild)

    const text = await binaryRunner.run({
      binary: '@bildit/artifact-finder',
      executeCommandArg: {
        agentInstance,
        command: ['artifact-finder', directory],
        returnOutput: true,
      },
    })
    const allArtifacts = JSON.parse(text)
    const artifactsToBuild = allArtifacts.filter(
      artifactToBuild =>
        !filesChangedSinceLastBuild ||
        filesChangedSinceLastBuild.find(file => file.startsWith(artifactToBuild.path + '/')),
    )

    return {artifactsToBuild, allArtifacts}
  }
}

const createJobFromArtifact = (artifact, repository, artifacts, changedFiles) => ({
  kind: artifact.type,
  artifact: artifact.artifact,
  repository,
  artifactPath: artifact.path,
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild:
    changedFiles && changedFiles.map(f => path.relative(artifact.path, f)),
})
