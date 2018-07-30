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

  await Promise.all(
    dependencies.map(async dependency => {
      const dependentPath = artifactToPathMap.get(dependency)

      debug('adding symlinks for dependency %s to %s', dependency, dependentPath)
      await agent.createSymlink(
        agentInstance,
        path.join(artifactDirectory, 'node_modules', dependency),
        path.join(directoryToBuild, dependentPath),
      )
    }),
  )
}

module.exports = symlinkDependencies
