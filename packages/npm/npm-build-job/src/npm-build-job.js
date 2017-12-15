'use strict'
const vm = require('vm')
const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')
const findNextVersion = require('./find-next-version')

const defaults = {
  steps: [
    {
      id: 'install',
      name: 'Install',
      command: ['npm', 'install'],
    },
    {
      id: 'increment-version',
      name: 'Increment Package Version',
      command: ({nextVersion}) => [
        'npm',
        'version',
        '--no-git-tag-version',
        '--allow-same-version',
        nextVersion,
      ],
      condition: ({packageJson, artifact: {publish}}) => !packageJson.private && publish,
    },
    {
      id: 'build',
      name: 'Build',
      command: ['npm', 'run', 'build'],
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
      command: ({access}) => ['npm', 'publish', '--access', access],
      condition: ({packageJson, artifact: {publish}}) => !packageJson.private && publish,
    },
  ],
  access: 'public',
}

module.exports = async ({
  pimport,
  config: {artifactDefaults, linkLocalPackages},
  plugins: [repositoryFetcher, commander],
}) => {
  return {
    artifactDefaults: {...defaults, ...artifactDefaults},
    async setupBuildSteps({job, agentInstance}) {
      const {
        dependencies,
        artifacts,
        artifact: {path: artifactPath},
        filesChangedSinceLastBuild,
      } = job
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

      const commanderSetup = await commander.setup({agentInstance})
      let nextVersion

      const artifact = job.artifact

      if (artifact.publish && !packageJson.private) {
        nextVersion = await findNextVersion(
          agent,
          agentInstance,
          directory,
          packageJson,
          commander,
          commanderSetup,
        )
      }

      return {
        buildContext: {
          packageJson,
          agentInstance,
          directory,
          commanderSetup,
          nextVersion,
        },
      }
    },

    getBuildSteps({buildContext}) {
      const {agentInstance, directory, commanderSetup, artifact} = buildContext
      const transform = command => commander.transformAgentCommand(command, {setup: commanderSetup})

      const buildSteps = artifact.steps
        .filter(s => evaluateStepCondition(s, buildContext))
        .map(s => (typeof s.command === 'function' ? {...s, command: s.command(buildContext)} : s))
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
