'use strict'
const path = require('path')
const debug = require('debug')('bilt:npm-build-job:symlink-dependencies')
const {createSymlink, executeCommand} = require('@bilt/host-agent')

async function symlinkDependencies(artifact, directoryToBuild, artifactDirectory, artifacts) {
  const artifactToPathMap = new Map(artifacts.map(artifact => [artifact.name, artifact.path]))

  await Promise.all(
    (artifact.dependencies || []).map(async dependency => {
      const dependentPath = artifactToPathMap.get(dependency)

      debug('adding symlinks for dependency %s to %s', dependency, dependentPath)
      await createSymlink(
        path.join(artifactDirectory, 'node_modules', dependency),
        path.join(directoryToBuild, dependentPath),
      )
    }),
  )
}

async function unsymlinkDependencies(artifact, artifactDirectory) {
  debug('removing dependencies %o', artifactDirectory, artifact.dependencies)

  await executeCommand({
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
