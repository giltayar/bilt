import {basename, extname} from 'path'
import Module from 'module'
import yaml from 'js-yaml'
const {load, YAMLException} = yaml
import find from 'lodash.find'
import pathOf from './path-of.js'
import parseAuthor from 'parse-author'
import debugMaker from 'debug'
const debug = debugMaker('bilt:artifact-finder')

const ARTIFACTRC_POSSIBLE_NAMES = [
  '.artifactrc',
  '.artifactrc.yaml',
  '.artifactrc.yml',
  '.artifactrc.json',
  '.artifactrc.js',
  'artifact.config.js',
]

/**
 * @param {(filname: string) => Promise<string>} fileFetcher
 */
export default (fileFetcher) => {
  return {
    /**
     * @param {string} filename
     * @param {string} basedir
     */
    async npmExtractor(filename, basedir) {
      if (basename(filename) != 'package.json') {
        return undefined
      }

      const packageJsonContents = await fileFetcher(filename)
      try {
        const packageJson = JSON.parse(packageJsonContents)
        const ret = {
          name: packageJson.name,
          path: pathOf(filename, basedir),
          type: 'npm',
          dependencies: Object.keys(packageJson.dependencies || {}).concat(
            Object.keys(packageJson.devDependencies || []),
          ),
          owners: (packageJson.contributors || [])
            .map(
              /**
               * @param {any} c
               */ (c) => c.email || parseAuthor(c).email,
            )
            .concat(
              packageJson.author ? packageJson.author || parseAuthor(packageJson.author).email : [],
            ),
        }
        debug('found npm artifact %o', ret)
        return ret
      } catch (e) {
        console.error(`package.json ${filename} did not parse correctly. Error:`, e.toString())
      }
    },
    /**
     * @param {string} filename
     * @param {string} basedir
     */
    async artifactsRcExtractor(filename, basedir) {
      if (!ARTIFACTRC_POSSIBLE_NAMES.includes(basename(filename))) {
        return undefined
      }

      const artifactsRcContents = await fileFetcher(filename)
      try {
        if (extname(filename) === '.js') {
          return loadModule(artifactsRcContents.toString(), filename)
        } else {
          return Object.assign(load(artifactsRcContents), {
            path: pathOf(filename, basedir),
          })
        }
      } catch (e) {
        if (e instanceof YAMLException) {
          console.error(`artifactrc.yml ${filename} did not parse`, e)
        }
        throw e
      }
    },
    /**
     * @param {((filename: string, basedir: string) => Promise<any>)[]} extractors
     */
    combinedExtractorCreator(extractors) {
      return (
        /**
         * @param {string} filename
         * @param {string} basedir
         */
        async (filename, basedir) => {
          return await Promise.all(extractors.map((extractor) => extractor(filename, basedir)))
            .then((extractorResults) => extractorResults.filter((r) => !!r))
            .then((extractorResults) => (extractorResults.length ? extractorResults : undefined))
        }
      )
    },
    /**
     * @param {any} artifacts
     */
    extractorMerger(artifacts) {
      const npmArtifact = find(artifacts, (e) => e.type === 'npm')
      const artifactsRcYmlArtifact = find(artifacts, (e) => !e.type)

      const npmDependencies = (npmArtifact || {}).dependencies || []
      const artifactsRcYmlDependencies = (artifactsRcYmlArtifact || {}).dependencies || []

      const mergedDependencies = {
        dependencies: Array.from(new Set([].concat(npmDependencies, artifactsRcYmlDependencies))),
      }

      if (npmArtifact || artifactsRcYmlArtifact) {
        return Object.assign({}, npmArtifact, artifactsRcYmlArtifact, mergedDependencies)
      } else {
        return undefined
      }
    },
  }
}

/**
 * @param {string} code
 * @param {string} filepath
 */
function loadModule(code, filepath) {
  const module = new Module(filepath, undefined)

  // @ts-expect-error
  module._compile(code, filepath)

  return module.exports
}
