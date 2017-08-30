'use strict'

const debug = require('debug')('bildit:repo-build-job')
const path = require('path')

module.exports = async ({pluginRepository}) => {
  const binaryRunner = await pluginRepository.findPlugin('binaryRunner:npm')

  return {
    async build(job, {agent, state, awakenedFrom}) {
      debug('running job repo-build-job')
      const {directory, repository, linkDependencies, filesChangedSinceLastBuild} = job

      const getInitialState = async () => {
        debug('fetching repository %s', repository)
        const agentInstance = await agent.getInstanceForJob({directory})

        await agent.fetchRepo(agentInstance, repository)
        const allArtifacts = JSON.parse(
          await binaryRunner.run({
            agent,
            agentInstance,
            binary: '@bildit/artifact-finder',
            commandArgs: ['artifact-finder', '.'],
            executeCommandOptions: {returnOutput: true},
          }),
        )
        const artifactsToBuild = allArtifacts.filter(
          artifactToBuild =>
            !filesChangedSinceLastBuild ||
            filesChangedSinceLastBuild.find(file => file.startsWith(artifactToBuild.path + '/')),
        )

        return {directory, artifactsToBuild, allArtifacts}
      }

      debug('files changed %o. Searching for artifacts', filesChangedSinceLastBuild)
      const newState = state || (await getInitialState(filesChangedSinceLastBuild))
      const artifactsToBuild = newState.artifactsToBuild
      debug('found artifacts %o', artifactsToBuild)
      const remainingArtifactsToBuild = newState.artifactsToBuild.filter(
        artifact => !awakenedFrom || awakenedFrom.job.artifact !== artifact.artifact,
      )
      debug('Remaining to build %o', remainingArtifactsToBuild.map(artifact => artifact.artifact))

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
          newState.directory,
          linkDependencies ? newState.allArtifacts : undefined,
          changedFiles,
        )

        debug('decided to run sub-job %o', artifactJob)
        return {
          state: Object.assign({}, newState, {
            artifactsToBuild: remainingArtifactsToBuild,
          }),
          jobs: [artifactJob].map(job => ({job, awaken: true})),
        }
      }
    },
  }
}

const createJobFromArtifact = (artifact, directory, artifacts, changedFiles) => ({
  kind: artifact.type,
  artifact: artifact.artifact,
  directory,
  artifactPath: artifact.path,
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild:
    changedFiles && changedFiles.map(f => path.relative(artifact.path, f)),
})
