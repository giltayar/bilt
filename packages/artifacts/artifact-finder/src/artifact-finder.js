'use strict'
const artifactWalker = require('./artifact-walker')
const artifactExtractorsCreator = require('./artifact-extractors')
const artifactDependenciesFilter = require('./artifact-dependency-filter')
const path = require('path')

module.exports = async () => {
  return {
    async findArtifacts(dir, agentFunctions) {
      const fileFetcher = filename => agentFunctions.readFileAsBuffer(filename)
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

const fetchEntriesOfDir = async dir => {
  const entryNames = await fs.readdirAsync(dir)

  return await Promise.all(
    entryNames.map(async name => {
      const fullName = path.join(dir, name)
      const stat = await fs.statAsync(fullName)
      return {name, type: stat.isDirectory() ? 'dir' : 'file'}
    }),
  )
}
