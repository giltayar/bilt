'use strict'

const debug = require('debug')('bildit:repo-build-job')
const artifactFinderFactory = require('../../../artifacts/artifact-finder')
const path = require('path')

module.exports = async ({pluginRepository, pluginInfo: {job: {kind}}}) => {
  if (kind !== 'repository') return false

  const artifactFinder = await artifactFinderFactory()
  const jobDispatcher = await pluginRepository.findPlugin({kind: 'jobDispatcher'})

  return {
    async runJob({directory, repository, linkDependencies}, {agent}) {
      debug('running job repo-build-job')
      debug('fetching repository %s', repository)
      const repoDirectory = await agent.fetchRepo(repository, {directory})

      const artifacts = await artifactFinder.findArtifacts(repoDirectory)
      debug('building artifacts %o', artifacts)

      for (const artifact of artifacts) {
        const job = createJobFromArtifact(
          artifact,
          repoDirectory,
          linkDependencies ? artifacts : undefined,
        )

        debug('running sub-job %o', job)
        await jobDispatcher.dispatchJob(job)
      }
    },
  }
}

const createJobFromArtifact = (artifact, directory, artifacts) => ({
  kind: artifact.type,
  artifactsDirectory: directory,
  directory: path.join(directory, artifact.path),
  dependencies: artifacts ? artifact.dependencies : [],
  artifacts,
})
