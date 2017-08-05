'use strict'

const debug = require('debug')('bildit:repo-build-job')
const artifactFinderFactory = require('@bildit/artifact-finder')
const path = require('path')

module.exports = async ({pluginInfo: {job: {kind}}}) => {
  if (kind !== 'repository') return false

  const artifactFinder = await artifactFinderFactory()

  return {
    async runJob(job, {agent, state}) {
      const {directory, repository, linkDependencies, filesChangedSinceLastBuild} = job
      debug('running job repo-build-job')
      debug('fetching repository %s', repository)
      debug('files changed %o', filesChangedSinceLastBuild)

      const findArtifacts = async () => {
        const repoDirectory = await agent.fetchRepo(repository, {directory})
        const artifactsToBuild = await artifactFinder.findArtifacts(repoDirectory)

        return {repoDirectory, artifactsToBuild}
      }

      const newState = state || (await findArtifacts())
      const artifactsToBuild = newState.artifactsToBuild
      debug('found artifacts %o', artifactsToBuild)

      if (!artifactsToBuild || artifactsToBuild.length === 0) {
        return
      }
      const artifactToBuild = artifactsToBuild[0]

      debug('building artifact %o', artifactToBuild)

      const changedFiles =
        filesChangedSinceLastBuild &&
        filesChangedSinceLastBuild.filter(file => file.startsWith(artifactToBuild.path + '/'))

      if (!changedFiles || changedFiles.length > 0) {
        const artifactJob = createJobFromArtifact(
          artifactToBuild,
          newState.repoDirectory,
          linkDependencies ? artifactsToBuild : undefined,
          changedFiles,
        )

        debug('running sub-job %o', artifactJob)
        return {
          state: Object.assign({}, newState, {
            artifactsToBuild: newState.artifactsToBuild.slice(1),
          }),
          jobs: [artifactJob].map(job => ({job, awaken: true})),
        }
      }
    },
  }
}

const createJobFromArtifact = (artifact, directory, artifacts, changedFiles) => ({
  kind: artifact.type,
  artifactsDirectory: directory,
  directory: path.join(directory, artifact.path),
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
  filesChangedSinceLastBuild:
    changedFiles && changedFiles.map(f => path.relative(artifact.path, f)),
})
