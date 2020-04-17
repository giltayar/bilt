'use strict'
const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

/**
 *
 * @param {{buildConfiguration: string|undefined}} config
 * @param {string} rootDirectory
 * @returns {Promise<object[]>}
 */
async function findBuildConfiguration(config, rootDirectory) {
  const buildConfigurationChain = []
  let buildConfigurationPath = config.buildConfiguration
  for (;;) {
    const buildConfiguration = YAML.parse(
      await fs.promises.readFile(
        buildConfigurationPath
          ? path.resolve(rootDirectory, buildConfigurationPath)
          : path.join(__dirname, 'default-build.yaml'),
        'utf8',
      ),
      {
        //@ts-ignore
        prettyErrors: true,
      },
    )

    buildConfigurationChain.push(buildConfiguration)

    if (buildConfiguration.extends) {
      buildConfigurationPath =
        buildConfiguration.extends === '#default' ? undefined : buildConfiguration.extends
    } else {
      break
    }
  }

  return buildConfigurationChain
}

module.exports = findBuildConfiguration
