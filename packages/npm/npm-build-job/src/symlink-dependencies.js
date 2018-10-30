'use strict'
const path = require('path')
const debug = require('debug')('bilt:npm-build-job:symlink-dependencies')

async function symlinkDependencies(
  {agent, agentInstance},
  artifact,
  directoryToBuild,
  artifactDirectory,
  artifacts,
) {
  const artifactToPathMap = new Map(artifacts.map(artifact => [artifact.name, artifact.path]))

  await Promise.all(
    (artifact.dependencies || []).map(async dependency => {
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

async function unsymlinkDependencies({agent, agentInstance}, artifact, artifactDirectory) {
  debug('removing dependencies %o', artifactDirectory, artifact.dependencies)

  await agent.executeCommand({
    agentInstance,
    command: [
      'rm',
      '-rf',
      ...(artifact.dependencies || []).map(dependency =>
        path.join(artifactDirectory, 'node_modules', dependency),
      ),
    ],
    cwd: artifactDirectory,
  })
}

module.exports = {symlinkDependencies, unsymlinkDependencies}
