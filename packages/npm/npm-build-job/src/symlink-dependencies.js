'use strict'
const debug = require('debug')('bilt:npm-build-job')
const path = require('path')

async function symlinkDependencies(
  {agent, agentInstance},
  dependencies,
  artifactDirectory,
  directoryToBuild,
  artifacts,
) {
  const artifactToPathMap = new Map(artifacts.map(artifact => [artifact.name, artifact.path]))

  const dependencyPaths = dependencies.map(dependency =>
    path.join(directoryToBuild, artifactToPathMap.get(dependency)),
  )

  debug('linking % to dependencies in %s', artifactDirectory, dependencyPaths)

  await agent.executeCommand({
    agentInstance,
    command: ['npm', 'link', ...dependencyPaths],
    cwd: artifactDirectory,
  })
}

module.exports = symlinkDependencies
