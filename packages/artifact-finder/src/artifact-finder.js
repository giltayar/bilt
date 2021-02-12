'use strict'
import artifactWalker from './artifact-walker.js'
import artifactExtractorsCreator from './artifact-extractors.js'
import artifactDependenciesFilter from './artifact-dependency-filter.js'
import ignore from 'ignore'
import {join} from 'path'
import {promises as fs} from 'fs'
import debugMaker from 'debug'
const debug = debugMaker('bilt:artifact-finder')

export default async () => {
  return {
    /**
     * @param {string} dir
     * @param {string} [ignoreFile]
     */
    async findArtifacts(dir, ignoreFile = '.gitignore') {
      const extractors = artifactExtractorsCreator((filename) => fs.readFile(filename, 'utf8'))

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

/**
 * @param {string} ignoreFile
 * @param {string} _baseDir
 * @param {string} dir
 * @param {string[]} ignoreStack
 */
async function fetchEntriesOfDir(ignoreFile, _baseDir, dir, ignoreStack = []) {
  const entryNames = await fs.readdir(dir)
  let retGitIgnored = ignoreStack
  if (entryNames.includes(ignoreFile)) {
    retGitIgnored = retGitIgnored.concat(
      (await fs.readFile(join(dir, ignoreFile), {encoding: 'utf-8'}))
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
          const fullName = join(dir, name)
          const fileStat = await fs.stat(fullName)
          return {name, type: fileStat.isDirectory() ? 'dir' : 'file'}
        }),
    ),
    ignoreStack: retGitIgnored,
  }
}
