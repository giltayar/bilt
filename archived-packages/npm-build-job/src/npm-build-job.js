'use strict'
const path = require('path')
const debug = require('debug')('bilt:npm-build-job')
const {pathExists, readFileAsBuffer} = require('@bilt/host-agent')
const {symlinkDependencies, unsymlinkDependencies} = require('./symlink-dependencies')
const {npmNextVersion} = require('@bilt/npm-next-version')

async function setupBuildSteps({job}) {
  const {
    artifacts,
    repositoryDirectory,
    artifact,
    artifact: {path: artifactPath, steps},
    filesChangedSinceLastBuild,
    hasChangedDependencies,
  } = job

  const directory = path.join(repositoryDirectory, artifactPath)
  debug('building npm package under directory %s', directory)

  const isFirstBuild = !(await pathExists(path.join(directory, 'node_modules')))
  const packageJsonChanged =
    isFirstBuild ||
    !filesChangedSinceLastBuild ||
    filesChangedSinceLastBuild.includes(`${artifactPath}/package.json`)

  debug('Reading package.json %s', path.join(directory, 'package.json'))
  const packageJson = JSON.parse(await readFileAsBuffer(path.join(directory, 'package.json')))

  let nextVersion

  if (steps.find(s => s.id === 'publish-bump-version') && !packageJson.private) {
    nextVersion = await npmNextVersion(packageJson)
  }

  return {
    buildContext: {
      packageJson,
      directory,
      repositoryDirectory,
      nextVersion,
      artifacts,
      artifact,
      packageJsonChanged,
      hasChangedDependencies,
    },
  }
}

const buildSteps = () => [
  {
    id: 'install-links-reset',
    name: 'Unlink local packages',
    funcCommand: async ({artifact, directory}) => await unsymlinkDependencies(artifact, directory),
    condition: ({packageJsonChanged, hasChangedDependencies}) =>
      packageJsonChanged || hasChangedDependencies,
  },
  {
    id: 'install-install',
    name: 'Install',
    command: ['npm', 'install'],
    condition: ({packageJsonChanged, hasChangedDependencies}) =>
      packageJsonChanged || hasChangedDependencies,
  },
  {
    id: 'install-ci',
    name: 'Install (CI)',
    command: ['npm', 'ci'],
    condition: ({packageJsonChanged, hasChangedDependencies}) =>
      packageJsonChanged || hasChangedDependencies,
  },
  {
    id: 'build-update-deps',
    name: 'Update dependencies',
    command: ({artifact: {dependencies}}) => ['npm', 'update', ...(dependencies || [])],
    condition: ({packageJsonChanged, hasChangedDependencies}) =>
      packageJsonChanged || hasChangedDependencies,
  },
  {
    id: 'install-links-link',
    name: 'Link local packages',
    funcCommand: async ({artifact, repositoryDirectory, directory, artifacts}) =>
      await symlinkDependencies(artifact, repositoryDirectory, directory, artifacts),
    condition: ({packageJsonChanged, hasChangedDependencies}) =>
      packageJsonChanged || hasChangedDependencies,
  },
  {
    id: 'publish-bump-version',
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

const enableSteps = ({buildConfig: {isFormalBuild = false} = {}}) =>
  isFormalBuild ? ['install-ci', 'build', 'test', 'publish'] : ['install', 'build', 'test']

const disableSteps = ({buildConfig: {isFormalBuild}}) =>
  isFormalBuild ? ['build-update-deps'] : ['install-ci']

module.exports = {
  setupBuildSteps,
  buildSteps,
  enableSteps,
  disableSteps,
}
