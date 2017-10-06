'use strict'
const debug = require('debug')('bildit:npm-build-job')
const path = require('path')

async function symlinkDependencies(dependencies, directory, artifacts, {agent, agentInstance}) {
  const artifactToPathMap = new Map(artifacts.map(artifact => [artifact.artifact, artifact.path]))

  await Promise.all(
    dependencies.map(async dependency => {
      const nodeModulesDir = path.join(directory, 'node_modules')
      const dependentPath = artifactToPathMap.get(dependency)

      debug('adding symlinks for dependency %s to %s', dependency, dependentPath)
      await agent.createSymlink(agentInstance, path.join(nodeModulesDir, dependency), dependentPath)
    }),
  )
}

module.exports = symlinkDependencies
