'use strict'

const debug = require('debug')('bildit:repo-build-job')
const path = require('path')

module.exports = async ({pimport}) => {
  const binaryRunner = await pimport('binaryRunner:npm')
  const repositoryFetcher = await pimport('repository-fetcher')

  return {
    async build(job, {agent, state, awakenedFrom}) {
      debug('running job repo-build-job')
      const {linkDependencies, filesChangedSinceLastBuild} = job

      const agentInstance = await agent.acquireInstanceForJob()

      const {directory} = await repositoryFetcher.fetchRepository({agentInstance})

      const newState =
        state || (await getInitialState(agentInstance, directory, filesChangedSinceLastBuild))

      const {artifactsToBuild} = newState
      debug('found artifacts %o', artifactsToBuild)
      const remainingArtifactsToBuild = newState.artifactsToBuild.filter(
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
          newState.repository,
          linkDependencies ? newState.allArtifacts : undefined,
          changedFiles,
        )

        debug('decided to run sub-job %o', artifactJob)

        agent.releaseInstanceForJob(agentInstance)

        return {
          state: Object.assign({}, newState, {
            artifactsToBuild: remainingArtifactsToBuild,
          }),
          jobs: [artifactJob].map(job => ({job, awaken: true})),
        }
      }
    },
  }

  async function getInitialState(agentInstance, directory, filesChangedSinceLastBuild) {
    debug('files changed %o. Searching for artifacts', filesChangedSinceLastBuild)

    const allArtifacts = JSON.parse(
      await binaryRunner.run({
        agentInstance,
        binary: '@bildit/artifact-finder',
        commandArgs: ['artifact-finder', directory],
        executeCommandOptions: {returnOutput: true},
      }),
    )
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
