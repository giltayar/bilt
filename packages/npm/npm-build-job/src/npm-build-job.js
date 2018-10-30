'use strict'
const vm = require('vm')
const path = require('path')
const debug = require('debug')('bilt:npm-build-job')
const {symlinkDependencies, unsymlinkDependencies} = require('./symlink-dependencies')
const findNextVersion = require('./find-next-version')

const defaultSteps = [
  {
    id: 'reset-links',
    name: 'Unlink local packages',
    funcCommand: async ({agent, agentInstance, artifact, directory}) =>
      await unsymlinkDependencies({agent, agentInstance}, artifact, directory),
    condition: ({packageJsonChanged, hasChangedDependencies}) =>
      packageJsonChanged || hasChangedDependencies,
  },
  {
    id: 'install',
    name: 'Install',
    command: ['npm', 'install'],
    condition: ({packageJsonChanged, hasChangedDependencies, steps}) =>
      packageJsonChanged || (hasChangedDependencies && !steps.find(step => step.id === 'link')),
  },
  {
    id: 'update',
    name: 'Update dependencies',
    funcCommand: async ({agent, agentInstance, artifact: {dependencies}, directory}) =>
      await agent.executeCommand({
        agentInstance,
        cwd: directory,
        command: ['npm', 'update', ...dependencies],
      }),
    condition: ({packageJsonChanged, hasChangedDependencies, steps}) =>
      packageJsonChanged || (hasChangedDependencies && !steps.find(step => step.id === 'link')),
  },
  {
    id: 'link',
    name: 'Link local packages',
    funcCommand: async ({agent, agentInstance, artifact, directoryToBuild, directory, artifacts}) =>
      await symlinkDependencies(
        {agent, agentInstance},
        artifact,
        directoryToBuild,
        directory,
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
        artifact,
        artifact: {path: artifactPath, steps},
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

      if (steps.find(s => s.id === 'increment-version') && !packageJson.private) {
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
          artifact,
          packageJsonChanged,
          hasChangedDependencies,
          steps,
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
