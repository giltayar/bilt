'use strict'
const path = require('path')
const debug = require('debug')('bilt:npm-build-job:symlink-dependencies')

async function symlinkDependencies(
  {agent, agentInstance},
  artifact,
  directoryToBuild,
  artifactDirectory,
) {
  debug('linking %s (in %s) to %s', artifact.name, artifactDirectory, directoryToBuild)

  await agent.createSymlink(
    agentInstance,
    path.join(directoryToBuild, 'node_modules', artifact.name),
    artifactDirectory,
  )

  for (const dependency of artifact.dependencies) {
    debug('linking %s to dependencies in %s', artifactDirectory, dependency)
    await agent.executeCommand({
      agentInstance,
      command: ['rm', '-rf', path.join(artifactDirectory, 'node_modules', dependency)],
      cwd: artifactDirectory,
    })
  }
}

module.exports = symlinkDependencies
