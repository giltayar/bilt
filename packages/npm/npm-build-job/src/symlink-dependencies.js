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

  debug('linking %s to dependencies %o', artifactDirectory, artifact.dependencies)

  await agent.executeCommand({
    agentInstance,
    command: [
      'rm',
      '-rf',
      ...artifact.dependencies.map(dependency =>
        path.join(artifactDirectory, 'node_modules', dependency),
      ),
    ],
    cwd: artifactDirectory,
  })
}

module.exports = symlinkDependencies
