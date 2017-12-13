'use strict'
const vm = require('vm')
const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')
const findNextVersion = require('./find-next-version')

module.exports = async ({
  pimport,
  config: {publish, linkLocalPackages, access = 'public', steps},
  plugins: [repositoryFetcher, npmCommander],
}) => {
  return {
    async setupBuildSteps({job, agentInstance}) {
      const {dependencies, artifacts, artifactPath, filesChangedSinceLastBuild} = job
      const agent = await pimport(agentInstance.kind)

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

      const npmCommanderSetup = await npmCommander.setup({agentInstance})
      const shouldPublish = publish && !packageJson.private
      let nextVersion

      if (shouldPublish) {
        nextVersion = await findNextVersion(
          agent,
          agentInstance,
          directory,
          packageJson,
          npmCommander,
          npmCommanderSetup,
        )
      }

      return {
        howToBuild: {
          packageJson,
          agentInstance,
          directory,
          npmCommanderSetup,
          nextVersion,
          shouldPublish,
          access,
        },
      }
    },

    getBuildSteps({howToBuild}) {
      const {agentInstance, directory, npmCommanderSetup} = howToBuild
      const transform = command =>
        npmCommander.transformAgentCommand(command, {setup: npmCommanderSetup})

      const buildSteps = steps
        .filter(s => evaluateStepCondition(s, howToBuild))
        .map(s => (typeof s.command === 'function' ? {...s, command: s.command(howToBuild)} : s))
        .map(s => transform({agentInstance, cwd: directory, ...s}))

      return {buildSteps}
    },
  }
}

function evaluateStepCondition({condition}, context) {
  if (!condition) return true
  if (typeof condition === 'string') {
    return vm.runInContext(condition, vm.createContext(context))
  } else {
    return condition(context)
  }
}

module.exports.plugins = ['repositoryFetcher', 'commander:npm']
