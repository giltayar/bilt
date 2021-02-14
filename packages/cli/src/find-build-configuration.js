import {resolve, join, dirname} from 'path'
import {cosmiconfig as _cosmiconfig} from 'cosmiconfig'
import {fileURLToPath, URL} from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 *
 * @param {{jobs: string|object |undefined}} config
 * @param {string} rootDirectory
 * @returns {Promise<import('@bilt/build-with-configuration').BuildConfiguration[]>}
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
            (await _cosmiconfig('bilt').load(
              jobsConfigurationOrBuildConfigurationPath
                ? resolve(buildConfigurationRootPath, jobsConfigurationOrBuildConfigurationPath)
                : join(__dirname, 'default-build.yaml'),
            )) || {config: undefined}
          ).config

    buildConfigurationChain.push(buildConfiguration)

    if (typeof jobsConfigurationOrBuildConfigurationPath === 'string') {
      buildConfigurationRootPath = dirname(
        resolve(buildConfigurationRootPath, jobsConfigurationOrBuildConfigurationPath),
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

export default findBuildConfiguration
