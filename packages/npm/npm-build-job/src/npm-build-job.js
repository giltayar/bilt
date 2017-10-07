'use strict'

const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')

module.exports = async ({
  pimport,
  config: {publish, linkLocalPackages},
  appConfig: {publish: appPublish},
  plugins: [npmPublisher, repositoryFetcher, npmAgentCommander],
}) => {
  return {
    async setupBuildSteps({job, agentInstance}) {
      const agent = await pimport(agentInstance.kind)
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
      }

      const packageJson = JSON.parse(
        await agent.readFileAsBuffer(agentInstance, path.join(directory, 'package.json')),
      )

      const npmAgentCommanderSetup = await npmAgentCommander.setup({agentInstance})

      const {howToBuild: howToBuildForPublish = {}} = shouldPublish(packageJson)
        ? await npmPublisher.setupBuildSteps({
            job,
            agentInstance,
            directory,
            packageJson,
          })
        : {}

      return {
        howToBuild: {
          packageJson,
          howToBuildForPublish,
          agentInstance,
          directory,
          npmAgentCommanderSetup,
        },
      }
    },
    getBuildSteps({
      howToBuild: {
        packageJson,
        howToBuildForPublish,
        agentInstance,
        directory,
        npmAgentCommanderSetup,
      },
      job,
    }) {
      const buildSteps = []

      const transform = command =>
        npmAgentCommander.transformAgentCommand(command, {setup: npmAgentCommanderSetup})

      debug('running npm install in job %o', job)
      buildSteps.push(transform({agentInstance, command: ['npm', 'install'], cwd: directory}))

      if ((packageJson.scripts || {}).build) {
        debug('adding npm run build in job %s', job.id)

        buildSteps.push(
          transform({
            agentInstance,
            command: ['npm', 'run', 'build'],
            cwd: directory,
          }),
        )
      }

      if ((packageJson.scripts || {}).test) {
        debug('adding npm test in job %s', job.id)

        buildSteps.push(transform({agentInstance, command: ['npm', 'test'], cwd: directory}))
      }

      if (shouldPublish(packageJson)) {
        buildSteps.push(
          ...npmPublisher.getBuildSteps({howToBuild: howToBuildForPublish}).buildSteps,
        )
      } else {
        debug(
          `not publishing because config publish is ${publish} or package json is private (${packageJson.private}`,
        )
      }

      return {buildSteps}
    },
  }

  function shouldPublish(packageJson) {
    return (publish || appPublish) && !packageJson.private
  }
}

module.exports.plugins = ['publisher:npm', 'repositoryFetcher', 'agentCommander:npm']
