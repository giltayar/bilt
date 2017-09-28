'use strict'

const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')

module.exports = async ({
  pimport,
  config: {publish, linkLocalPackages},
  appConfig: {publish: appPublish},
}) => {
  const npmPublisher = await pimport('publisher:npm')
  const repositoryFetcher = await pimport('repositoryFetcher')

  return {
    async setupBuildSteps({job, agentInstance}) {
      const agent = await pimport(`agent:${agentInstance.kind}`)
      const {dependencies, artifacts, artifactPath, filesChangedSinceLastBuild} = job

      const {directory} = await repositoryFetcher.fetchRepository({
        agentInstance,
        subdirectory: artifactPath,
      })

      const packageJsonChanged =
        !filesChangedSinceLastBuild || filesChangedSinceLastBuild.includes('package.json')

      if (packageJsonChanged) {
        if (dependencies && linkLocalPackages) {
          debug('linking to dependent packages %o', dependencies)
          await symlinkDependencies({agent, agentInstance}, dependencies, artifactPath, artifacts)
        }

        debug('running npm install in job %o', job)
        await agent.executeCommand({agentInstance, command: ['npm', 'install'], cwd: directory})
      }

      const packageJson = JSON.parse(
        await agent.readFileAsBuffer(agentInstance, path.join(directory, 'package.json')),
      )

      const {howToBuild: howToBuildForPublish} = await npmPublisher.setupBuildSteps({
        job,
        agentInstance,
      })

      return {packageJson, howToBuildForPublish, agentInstance, directory}
    },
    getBuildSteps({
      howToBuild: {packageJson, howToBuildForPublish, agentInstance, directory},
      job,
    }) {
      const ret = []
      if ((packageJson.scripts || {}).build) {
        debug('adding npm run build in job %s', job.id)

        ret.push({
          agentInstance,
          command: ['npm', 'run', 'build'],
          cwd: directory,
        })
      }

      if ((packageJson.scripts || {}).test) {
        debug('adding npm test in job %s', job.id)

        ret.push({agentInstance, command: ['npm', 'test'], cwd: directory})
      }

      if ((publish || appPublish) && !packageJson.private) {
        ret.push(...npmPublisher.getBuildSteps({howToBuild: howToBuildForPublish}))
      } else {
        debug(
          `not publishing because config publish is ${publish} or package json is private (${packageJson.private}`,
        )
      }
    },
  }
}
