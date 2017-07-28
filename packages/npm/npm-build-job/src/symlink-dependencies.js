'use strict'
const fs = require('fs')
const {promisify} = require('util')
const makeDir = require('make-dir')
const debug = require('debug')('bildit:npm-build-job')
const path = require('path')

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

async function createSymlink(link, linkTarget) {
  try {
    await promisify(fs.symlink)(linkTarget, link)
  } catch (err) {
    if (err.code === 'EEXIST') {
      // dir exists (probably as symlink), needs to be deleted
      // TODO - if a real directory, we need to rimraf it
      await promisify(fs.unlink)(link)

      await createSymlink(link, linkTarget)
    } else if (err.code === 'ENOENT') {
      // parent directories do not exist, need to be created
      await makeDir(path.dirname(link))

      await createSymlink(link, linkTarget)
    } else {
      throw err
    }
  }
}
