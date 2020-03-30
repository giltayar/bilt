'use strict'
const artifactWalker = require('./artifact-walker')
const artifactExtractorsCreator = require('./artifact-extractors')
const artifactDependenciesFilter = require('./artifact-dependency-filter')
const ignore = require('ignore')
const path = require('path')
const fs = require('fs')
const {promisify} = require('util')
const debug = require('debug')('bilt:artifact-finder')

module.exports = async () => {
  return {
    async findArtifacts(dir, ignoreFile = '.gitignore') {
      const fileFetcher = (filename) => promisify(fs.readFile)(filename)
      const extractors = artifactExtractorsCreator(fileFetcher)

      const artifacts = await artifactWalker(
        fetchEntriesOfDir.bind(undefined, ignoreFile, dir),
        dir,
        extractors.combinedExtractorCreator([
          extractors.npmExtractor,
          extractors.artifactsRcExtractor,
        ]),
        extractors.extractorMerger,
      )
      const filteredDependenciesArtifacts = artifactDependenciesFilter(artifacts)
      debug('found artifacts: %o', filteredDependenciesArtifacts)

      return filteredDependenciesArtifacts
    },
  }
}

const readdirAsync = promisify(fs.readdir)
const statAsync = promisify(fs.stat)
const readFileAsync = promisify(fs.readFile)

const fetchEntriesOfDir = async (ignoreFile, baseDir, dir, ignoreStack = []) => {
  const entryNames = await readdirAsync(dir)
  let retGitIgnored = ignoreStack
  if (entryNames.includes(ignoreFile)) {
    retGitIgnored = retGitIgnored.concat(
      (await readFileAsync(path.join(dir, ignoreFile), {encoding: 'utf-8'}))
        .split(/\r?\n/g)
        .filter((l) => l.trim() && !l.trim().startsWith('#')),
    )
  }
  const igFilter = ignore().add(retGitIgnored).createFilter()

  return {
    entries: await Promise.all(
      entryNames
        .filter((name) => !name.startsWith('.') && igFilter(name))
        .map(async (name) => {
          const fullName = path.join(dir, name)
          const stat = await statAsync(fullName)
          return {name, type: stat.isDirectory() ? 'dir' : 'file'}
        }),
    ),
    ignoreStack: retGitIgnored,
  }
}
