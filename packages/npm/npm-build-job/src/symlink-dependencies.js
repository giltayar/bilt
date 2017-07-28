'use strict'
const debug = require('debug')('bildit:npm-build-job')
const path = require('path')
const {createSymlink} = require('@bildit/symlink')

module.exports = async function(dependencies, directory, artifacts, artifactsDirectory) {
  const artifactToPathMap = new Map(
    artifacts.map(artifact => [artifact.artifact, path.resolve(artifactsDirectory, artifact.path)]),
  )

  await Promise.all(
    dependencies.map(async dependency => {
      const nodeModulesDir = path.resolve(directory, 'node_modules')
      const dependentPath = artifactToPathMap.get(dependency)

      debug('adding symlinks for dependency %s to %s', dependency, dependentPath)
      await createSymlink(path.resolve(nodeModulesDir, dependency), dependentPath)
    }),
  )
}
