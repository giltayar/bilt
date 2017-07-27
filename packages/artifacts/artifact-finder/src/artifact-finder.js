'use strict'
const artifactWalker = require('./artifact-walker')
const artifactExtractorsCreator = require('./artifact-extractors')
const artifactDependenciesFilter = require('./artifact-dependency-filter')
const path = require('path')
const fs = require('fs')
const {promisify} = require('util')

module.exports = async () => {
  return {
    async findArtifacts(dir) {
      const fileFetcher = filename => promisify(fs.readFile)(filename)
      const extractors = artifactExtractorsCreator(fileFetcher)

      const artifacts = await artifactWalker(
        fetchEntriesOfDir,
        dir,
        extractors.combinedExtractorCreator([
          extractors.npmExtractor,
          extractors.dockerExtractor,
          extractors.artifactsRcYmlExtractor,
        ]),
        extractors.extractorMerger,
      )
      const filteredDependenciesArtifacts = artifactDependenciesFilter(artifacts)

      return filteredDependenciesArtifacts
    },
  }
}

const readdirAsync = promisify(fs.readdir)
const statAsync = promisify(fs.stat)

const fetchEntriesOfDir = async dir => {
  const entryNames = await readdirAsync(dir)

  return await Promise.all(
    entryNames.map(async name => {
      const fullName = path.join(dir, name)
      const stat = await statAsync(fullName)
      return {name, type: stat.isDirectory() ? 'dir' : 'file'}
    }),
  )
}
