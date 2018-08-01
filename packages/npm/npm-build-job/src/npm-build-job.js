'use strict'
const vm = require('vm')
const path = require('path')
const debug = require('debug')('bilt:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')
const findNextVersion = require('./find-next-version')

const defaultSteps = [
  {
    id: 'install',
    name: 'Install',
    command: ['npm', 'install'],
    condition: ({packageJsonChanged, hasChangedDependencies}) =>
      packageJsonChanged || hasChangedDependencies,
  },
  {
    id: 'link',
    name: 'Link local packages',
    funcCommand: async ({
      agent,
      agentInstance,
      dependencies,
      directory,
      directoryToBuild,
      artifacts,
    }) =>
      await symlinkDependencies(
        {agent, agentInstance},
        dependencies,
        directory,
        directoryToBuild,
        artifacts,
      ),
    condition: ({packageJsonChanged, hasChangedDependencies}) =>
      packageJsonChanged || hasChangedDependencies,
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
    condition: ({packageJson, artifact: {publish}}) =>
      !packageJson.private && (publish === undefined || publish),
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
    command: ({access}) => ['npm', 'publish', '--access', access || 'public'],
    condition: ({packageJson, artifact: {publish}}) =>
      !packageJson.private && (publish === undefined || publish),
  },
]

module.exports = async ({
  pimport,
  config: {artifactDefaults = {}},
  plugins: [repositoryFetcher, commander],
}) => {
  return {
    defaultSteps,
    artifactDefaults: {publish: true, ...artifactDefaults},
    async setupBuildSteps({job, agentInstance}) {
      const {
        artifacts,
        artifact: {path: artifactPath},
        filesChangedSinceLastBuild,
        hasChangedDependencies,
      } = job
      const agent = await pimport(agentInstance.kind)

      const {directory: directoryToBuild} = await repositoryFetcher.fetchRepository({
        agentInstance,
      })

      const directory = path.join(directoryToBuild, artifactPath)
      debug('building npm package under directory %s', directory)

      const packageJsonChanged =
        !filesChangedSinceLastBuild ||
        filesChangedSinceLastBuild.includes(`${artifactPath}/package.json`)

      debug(
        'Reading package.json %s using agent %o',
        path.join(directory, 'package.json'),
        agentInstance,
      )
      const packageJson = JSON.parse(
        await agent.readFileAsBuffer(agentInstance, path.join(directory, 'package.json')),
      )

      const commanderSetup = await commander.setup({agentInstance})
      let nextVersion

      const artifact = job.artifact

      if (artifact.steps.find(s => s.id === 'increment-version') && !packageJson.private) {
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
          agent,
          agentInstance,
          directory,
          directoryToBuild,
          commanderSetup,
          nextVersion,
          artifacts,
          packageJsonChanged,
          hasChangedDependencies,
        },
      }
    },

    getBuildSteps({buildContext}) {
      const {agentInstance, directory, commanderSetup, artifact} = buildContext
      const transform = command => commander.transformAgentCommand(command, {setup: commanderSetup})

      const buildSteps = artifact.steps
        .filter(s => evaluateStepCondition(s, buildContext))
        .map(
          s =>
            s.funcCommand != null
              ? s
              : typeof s.command === 'function'
                ? {...s, command: s.command(buildContext)}
                : s,
        )
        .map(
          s =>
            s.funcCommand != null
              ? () => s.funcCommand(buildContext)
              : transform({agentInstance, cwd: directory, ...s}),
        )

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
