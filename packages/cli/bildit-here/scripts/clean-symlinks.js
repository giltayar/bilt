#!/usr/bin/env node
const path = require('path')
const artifactFinderFactory = require('../../../artifacts/artifact-finder')
const {createSymlink} = require('../../../fs/symlink')
const fs = require('fs')
const {promisify: p} = require('util')

main().catch(err => console.error(err.stack))

async function main() {
  const artifactFinder = await artifactFinderFactory()

  const repoDirectory = path.resolve(__dirname, '../../../..')
  console.log('finding artifacts in', repoDirectory)
  const artifacts = (await artifactFinder.findArtifacts(repoDirectory)).filter(a =>
    a.path.startsWith('packages/'),
  )
  console.log(artifacts.map(artifact => artifact.artifact).join('\n'))

  await Promise.all(
    artifacts.map(async artifact => {
      try {
        await p(fs.unlink)(path.join(repoDirectory, 'node_modules', artifact.artifact))
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
    }),
  )
}
