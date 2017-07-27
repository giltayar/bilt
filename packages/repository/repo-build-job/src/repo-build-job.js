'use strict'

const debug = require('debug')('bildit:repo-build-job')
const artifactFinderFactory = require('../../../artifacts/artifact-finder')
const path = require('path')

module.exports = async ({pluginRepository, pluginInfo: {job: {kind}}}) => {
  if (kind !== 'repository') return false

  const artifactFinder = await artifactFinderFactory()
  const jobDispatcher = await pluginRepository.findPlugin({kind: 'jobDispatcher'})

  return {
    async runJob({repository}, {agent}) {
      debug('running job repo-build-job')
      debug('fetching repository %s', repository)
      const directory = await agent.fetchRepo(repository)

      const artifacts = await artifactFinder.findArtifacts(directory)
      debug('building artifacts %o', artifacts)

      for (const artifact of artifacts) {
        const job = createJobFromArtifact(artifact, directory)

        debug('running sub-job %o', job)
        await jobDispatcher.dispatchJob(job)
      }
    },
  }
}

const createJobFromArtifact = (artifact, directory) => ({
  kind: artifact.type,
  directory: path.join(directory, artifact.path),
})
