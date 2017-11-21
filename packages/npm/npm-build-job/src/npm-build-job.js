'use strict'
const vm = require('vm')
const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')
const findNextVersion = require('./find-next-version')

module.exports = async ({
  pimport,
  config: {publish, linkLocalPackages},
  appConfig: {publish: appPublish},
  plugins: [repositoryFetcher, npmCommander, npmBinaryRunner],
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

      const npmCommanderSetup = await npmCommander.setup({agentInstance})
      const shouldPublish = (publish || appPublish) && !packageJson.private
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
        },
      }
    },

    getBuildSteps({howToBuild}) {
      const {agentInstance, directory, npmCommanderSetup} = howToBuild
      const transform = command =>
        npmCommander.transformAgentCommand(command, {setup: npmCommanderSetup})

      const buildSteps = builtinSteps
        .filter(s => evaluateStepCondition(s, howToBuild))
        .map(s => transform({agentInstance, cwd: directory, ...s}))

      return {buildSteps}
    },
  }
}

function evaluateStepCondition({condition}, context) {
  if (typeof condition === 'string') {
    return vm.runInContext(condition, vm.createContext(context))
  } else {
    return condition(context)
  }
}

const builtinSteps = [
  {
    id: 'install',
    name: 'Install',
    command: ['npm', 'install'],
  },
  {
    id: 'increment-version',
    name: 'Increment Package Version',
    command: ({nextVersion}) => ['npm', 'version', '--no-git-tag-version', nextVersion],
    condition: ({packageJson, shouldPublish}) => !packageJson.private && shouldPublish,
  },
  {
    id: 'build',
    name: 'Build',
    command: ['npm run build'],
    condition: ({packageJson}) => packageJson.scripts && packageJson.scripts.build,
  },
  {
    id: 'test',
    name: 'Test',
    command: ['npm', 'test'],
    condition: ({packageJson}) => packageJson.scripts && packageJson.scripts.test,
  },
  {
    id: 'publish',
    name: 'Publish',
    command: ['npm', 'publish'],
    condition: ({packageJson, shouldPublish}) => !packageJson.private && shouldPublish,
  },
]

module.exports.plugins = ['repositoryFetcher', 'commander:npm', 'binaryRunner:npm']
