'use strict'
const path = require('path')
const Module = require('module')
const yaml = require('js-yaml')
const find = require('lodash.find')
const pathOf = require('./path-of')
const parseAuthor = require('parse-author')
const debug = require('debug')('bilt:artifact-finder')

const ARTIFACTRC_POSSIBLE_NAMES = [
  '.artifactrc',
  '.artifactrc.yaml',
  '.artifactrc.yml',
  '.artifactrc.json',
  '.artifactrc.js',
  'artifact.config.js',
]

module.exports = fileFetcher => {
  return {
    async npmExtractor(filename, basedir) {
      if (path.basename(filename) != 'package.json') {
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
            .map(c => c.email || parseAuthor(c).email)
            .concat(
              packageJson.author ? packageJson.author || parseAuthor(packageJson.author).email : [],
            ),
        }
        debug('found npm artifact %o', ret)
        return ret
      } catch (e) {
        if (e instanceof SyntaxError) {
          console.error(`package.json ${filename} did not parse`, e)
        }
        throw e
      }
    },
    async dockerExtractor(filename, basedir) {
      if (path.basename(filename) === 'Dockerfile') {
        const ret = {
          name: path.basename(path.dirname(filename)),
          path: pathOf(filename, basedir),
          type: 'docker',
        }
        debug('found docker artifact %o', ret)

        return ret
      } else {
        return undefined
      }
    },
    async artifactsRcExtractor(filename, basedir) {
      if (!ARTIFACTRC_POSSIBLE_NAMES.includes(path.basename(filename))) {
        return undefined
      }

      const artifactsRcContents = await fileFetcher(filename)
      try {
        if (path.extname(filename) === '.js') {
          return loadModule(artifactsRcContents.toString(), filename)
        } else {
          return Object.assign(yaml.safeLoad(artifactsRcContents), {
            path: pathOf(filename, basedir),
          })
        }
      } catch (e) {
        if (e instanceof yaml.YAMLExtension) {
          console.error(`artifactrc.yml ${filename} did not parse`, e)
        }
        throw e
      }
    },
    combinedExtractorCreator(extractors) {
      return async (filename, basedir) => {
        return await Promise.all(extractors.map(extractor => extractor(filename, basedir)))
          .then(extractorResults => extractorResults.filter(r => !!r))
          .then(extractorResults => (extractorResults.length ? extractorResults : undefined))
      }
    },
    extractorMerger(artifacts) {
      const npmArtifact = find(artifacts, e => e.type === 'npm')
      const dockerArtifact = find(artifacts, e => e.type === 'docker')
      const artifactsRcYmlArtifact = find(artifacts, e => !e.type)

      const npmDependencies = (npmArtifact || {}).dependencies || []
      const dockerDependencies = (dockerArtifact || {}).dependencies || []
      const artifactsRcYmlDependencies = (artifactsRcYmlArtifact || {}).dependencies || []

      const mergedDependencies = {
        dependencies: Array.from(
          new Set([].concat(npmDependencies, dockerDependencies, artifactsRcYmlDependencies)),
        ),
      }

      if (npmArtifact && dockerArtifact) {
        return Object.assign(
          {},
          dockerArtifact,
          npmArtifact,
          {type: 'docker-npm'},
          artifactsRcYmlArtifact,
          mergedDependencies,
        )
      } else if (npmArtifact || dockerArtifact || artifactsRcYmlArtifact) {
        return Object.assign(
          {},
          npmArtifact,
          dockerArtifact,
          artifactsRcYmlArtifact,
          mergedDependencies,
        )
      } else {
        return undefined
      }
    },
  }
}

function loadModule(code, filepath) {
  const module = new Module(filepath, null)

  module._compile(code, filepath)

  return module.exports
}
