'use strict'
const path = require('path')
const cosmiconfig = require('cosmiconfig')

/**
 *
 * @param {{jobs: string|object |undefined}} config
 * @param {string} rootDirectory
 * @returns {Promise<object[]>}
 */
async function findBuildConfiguration(config, rootDirectory) {
  const buildConfigurationChain = []
  let jobsConfigurationOrBuildConfigurationPath = config.jobs
  let buildConfigurationRootPath = rootDirectory
  for (;;) {
    const buildConfiguration =
      jobsConfigurationOrBuildConfigurationPath &&
      typeof jobsConfigurationOrBuildConfigurationPath === 'object'
        ? {jobs: config.jobs}
        : (
            await cosmiconfig
              .cosmiconfig('bilt')
              .load(
                jobsConfigurationOrBuildConfigurationPath
                  ? path.resolve(
                      buildConfigurationRootPath,
                      jobsConfigurationOrBuildConfigurationPath,
                    )
                  : path.join(__dirname, 'default-build.yaml'),
              )
          ).config

    buildConfigurationChain.push(buildConfiguration)

    if (typeof jobsConfigurationOrBuildConfigurationPath === 'string') {
      buildConfigurationRootPath = path.dirname(
        path.resolve(buildConfigurationRootPath, jobsConfigurationOrBuildConfigurationPath),
      )
    }

    if (buildConfiguration.extends) {
      jobsConfigurationOrBuildConfigurationPath =
        buildConfiguration.extends === '#default' ? undefined : buildConfiguration.extends
    } else {
      break
    }
  }

  return buildConfigurationChain
}

module.exports = findBuildConfiguration
