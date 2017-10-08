'use strict'

const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')
const {getPublishBuildSteps, setupPublishBuildSteps} = require('./npm-publisher-with-git')

module.exports = async ({
  pimport,
  config: {publish, linkLocalPackages},
  appConfig: {publish: appPublish},
  plugins: [repositoryFetcher, npmAgentCommander, gitAgentCommander],
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
      const gitAgentCommanderSetup = await gitAgentCommander.setup({agentInstance})

      if (shouldPublish(packageJson)) {
        await setupPublishBuildSteps({
          job,
          agent,
          agentInstance,
          directory,
          gitAgentCommander,
          gitAgentCommanderSetup,
        })
      }

      return {
        howToBuild: {
          packageJson,
          agentInstance,
          directory,
          npmAgentCommanderSetup,
          gitAgentCommanderSetup,
        },
      }
    },
    getBuildSteps({
      howToBuild: {
        packageJson,
        agentInstance,
        directory,
        npmAgentCommanderSetup,
        gitAgentCommanderSetup,
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
          ...getPublishBuildSteps({
            directory,
            packageJson,
            agentInstance,
            npmAgentCommander,
            npmAgentCommanderSetup,
            gitAgentCommander,
            gitAgentCommanderSetup,
          }),
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

module.exports.plugins = ['repositoryFetcher', 'agentCommander:npm', 'agentCommander:git']
