'use strict'
const vm = require('vm')
const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')

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

      if (shouldPublish(packageJson)) {
        await npmBinaryRunner.run({binary: 'wix-version-incrementor????'})
      }

      const npmCommanderSetup = await npmCommander.setup({agentInstance})

      return {
        howToBuild: {
          packageJson,
          agentInstance,
          directory,
          npmCommanderSetup,
        },
      }
    },

    getBuildSteps({howToBuild: {packageJson, agentInstance, directory, npmCommanderSetup}}) {
      const transform = command =>
        npmCommander.transformAgentCommand(command, {setup: npmCommanderSetup})

      const buildSteps = builtinSteps
        .filter(s => evaluateStepCondition(s, {packageJson, publish: shouldPublish(packageJson)}))
        .map(s => transform({agentInstance, cwd: directory, ...s}))

      return {buildSteps}
    },
  }

  function shouldPublish(packageJson) {
    return (publish || appPublish) && !packageJson.private
  }
}

function evaluateStepCondition({condition}, context) {
  return vm.runInContext(condition, vm.createContext(context))
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
    command: 'wix-version-incrementor????',
    condition: '!packageJson.private && publish',
  },
  {
    id: 'build',
    name: 'Build',
    command: ['npm run build'],
    condition: 'packageJson.scripts.build',
  },
  {
    id: 'test',
    name: 'Test',
    command: ['npm', 'test'],
    condition: 'packageJson.scripts.test',
  },
  {
    id: 'publish',
    name: 'Publish',
    command: ['npm', 'publish'],
    condition: '!packageJson.private && publish',
  },
]

module.exports.plugins = ['repositoryFetcher', 'commander:npm', 'binaryRunner:npm']
