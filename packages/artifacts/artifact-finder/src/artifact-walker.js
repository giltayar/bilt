'use strict'
const flatten = require('lodash/flatten')
const find = require('lodash/find')
const path = require('path')

const artifactWalker = async (
  fetchEntriesOfDir,
  dir,
  extractArtifacts,
  extractorMerger,
  baseDir = dir,
) => {
  const entries = await fetchEntriesOfDir(dir)
  const filenames = entries
    .filter(entry => entry.type === 'file')
    .map(entry => path.join(dir, entry.name))

  const artifactsOfFiles = await Promise.all(
    filenames.map(filename => extractArtifacts(filename, baseDir)),
  )

  const aFileIsAnArtifactLeaf = d => !!d

  if (find(artifactsOfFiles, aFileIsAnArtifactLeaf)) {
    return extractorMerger(flatten(artifactsOfFiles).filter(a => !!a))
  }

  const artifacts = await Promise.all(
    entries
      .filter(entry => entry.type === 'dir')
      .map(entry =>
        artifactWalker(
          fetchEntriesOfDir,
          path.join(dir, entry.name),
          extractArtifacts,
          extractorMerger,
          baseDir,
        ),
      ),
  )

  return flatten(artifacts).filter(a => !!a)
}

module.exports = artifactWalker
