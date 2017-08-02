'use strict'

const debug = require('debug')('bildit:repo-build-job')
const artifactFinderFactory = require('@bildit/artifact-finder')
const path = require('path')

module.exports = async ({pluginRepository, pluginInfo: {job: {kind}}}) => {
  if (kind !== 'repository') return false

  const artifactFinder = await artifactFinderFactory()
  const jobDispatcher = await pluginRepository.findPlugin({kind: 'jobDispatcher'})

  return {
    async runJob({directory, repository, linkDependencies, filesChangedSinceLastBuild}, {agent}) {
      debug('running job repo-build-job')
      debug('fetching repository %s', repository)
      debug('files changed %o', filesChangedSinceLastBuild)
      const repoDirectory = await agent.fetchRepo(repository, {directory})

      const artifacts = await artifactFinder.findArtifacts(repoDirectory)
      debug('building artifacts %o', artifacts)

      for (const artifact of artifacts) {
        const changedFiles =
          filesChangedSinceLastBuild &&
          filesChangedSinceLastBuild.filter(file => file.startsWith(artifact.path + '/'))

        if (!changedFiles || changedFiles.length > 0) {
          const job = createJobFromArtifact(
            artifact,
            repoDirectory,
            linkDependencies ? artifacts : undefined,
            changedFiles,
          )

          debug('running sub-job %o', job)
          await jobDispatcher.dispatchJob(job)
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
