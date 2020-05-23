'use strict'
const path = require('path')
const fs = require('fs')
const yargs = require('yargs')
const debug = require('debug')('bilt:cli:cli')
const globby = require('globby')
const {jobInfo, validateBuildConfiguration} = require('@bilt/build-with-configuration')
const findConfig = require('./find-config')
const findBuildConfiguration = require('./find-build-configuration')

async function main(argv) {
  const {config, rootDirectory} = await findConfig(argv)

  setupPackages('upto', 'cwd', rootDirectory)(config)

  const buildConfigurationChain = await findBuildConfiguration(config, rootDirectory)

  const yargsOptions = generateYargsCommandsAndOptions(
    argv,
    config,
    buildConfigurationChain,
    rootDirectory,
  )

  const {
    _: [jobId = 'build'],
    ...args
  } = await yargsOptions.strict().help().parse()
  debug('final options', {rootDirectory, config, jobId, args})

  await require(`./command-build`)({
    jobId: /**@type{string}*/ (jobId),
    rootDirectory: /**@type{import('@bilt/types').Directory}*/ (rootDirectory),
    jobConfiguration: findJobConfigurationInChain(buildConfigurationChain, jobId),
    ...args,
  })
}

/**
 * @param {string[]} argv
 * @param {any} config
 * @param {any[]} buildConfigurationChain
 * @param {string} rootDirectory
 * @returns {import('yargs').Argv}
 */
function generateYargsCommandsAndOptions(argv, config, buildConfigurationChain, rootDirectory) {
  let y = yargs(argv)
    .config(config)
    .option('config', {
      alias: 'c',
      describe: 'the bilt configuration file',
      type: 'string',
    })
    .option('packages', {
      describe: 'the set of all packages to take into consideration',
      type: 'string',
      array: true,
      hidden: true,
    })
    .option('jobDefaults', {
      hidden: true,
    })
    .option('jobs', {
      hidden: true,
    })

  for (const buildConfiguration of buildConfigurationChain) {
    validateBuildConfiguration(buildConfiguration, rootDirectory)
    for (const jobId of Object.keys(buildConfiguration.jobs)) {
      y = y.command(
        jobId === 'build'
          ? ['build [packagesToBuild..]', '* [packagesToBuild..]']
          : [`${jobId} [packagesToBuild...]`],
        `${jobId} packages`,
        (yargs) => {
          yargs
            .positional('packagesToBuild', {
              describe:
                'list of packages to build. Use "*" or leave empty to autofind packages in cwd',
              type: 'string',
              array: true,
            })
            .option('dry-run', {
              describe: 'just show what packages will be built and in what order',
              type: 'boolean',
              default: false,
            })
            .option('force', {
              alias: 'f',
              describe: 'force build of packages',
              type: 'boolean',
              default: false,
            })
            .option('upto', {
              alias: 'u',
              describe: 'packages to build up to. Use "-" for no upto-s',
              type: 'string',
              array: true,
            })
            .option('no-upto', {
              alias: 'n',
              type: 'string',
              boolean: true,
              describe: 'disable upto, even if configured in .biltrc',
            })
            .option('before', {
              type: 'boolean',
              describe: 'execute the steps before building the packages',
              defaultDescription: 'true',
            })
            .option('after', {
              type: 'boolean',
              describe: 'execute the steps after building the packages',
              defaultDescription: 'true',
            })
            .option('envelope', {
              type: 'boolean',
              describe: 'execute the steps before and after building the packages',
              defaultDescription: 'true',
            })
            .middleware(supportDashUpto)
            .middleware(setupPackages('packagesToBuild', 'cwd', rootDirectory))
            .middleware(setupPackages('packages', 'configpath', rootDirectory))
            .middleware(setupPackages('upto', 'cwd', rootDirectory))
            .middleware(setupPackages('configUpto', 'configpath', rootDirectory))

          const {enableOptions, parameterOptions, aggregateOptions, inAggregateOptions} = jobInfo(
            buildConfiguration,
            jobId,
          )
          const optionDefaults = (config.jobDefaults || {})[jobId] || {} || {}

          for (const enableOption of enableOptions) {
            yargs = yargs.option(
              ...makeEnableOption(
                enableOption,
                optionDefaults,
                aggregateOptions,
                inAggregateOptions,
              ),
            )
          }

          yargs = yargs.middleware(dealWithAggregateOptions(aggregateOptions, inAggregateOptions))
          for (const parameterOption of parameterOptions) {
            yargs = yargs.option(...makeParameterOption(parameterOption, optionDefaults))
          }

          return yargs
        },
      )
    }
  }

  return y
}

/**
 * @param {Map<string, string[]>} aggregateOptions
 * @param {Map<string, string>} inAggregateOptions
 */
function dealWithAggregateOptions(aggregateOptions, inAggregateOptions) {
  return (argv) => {
    for (const aggregateOption of [...aggregateOptions.keys()].concat('envelope')) {
      argv[aggregateOption] = argv[aggregateOption] === undefined ? true : argv[aggregateOption]
    }

    for (const [inAggregateOption, aggregateOption] of [...inAggregateOptions.entries()].concat([
      ['before', 'envelope'],
      ['after', 'envelope'],
    ])) {
      argv[inAggregateOption] =
        argv[inAggregateOption] === undefined ? argv[aggregateOption] : argv[inAggregateOption]
    }

    return argv
  }
}

/**
 * @param {string} option
 * @param {'cwd'|'configpath'} cwd
 */
function setupPackages(option, cwd, rootDirectory) {
  /**
   * @param {string} v
   */
  const isGlob = (v) => v.startsWith('.') || v.startsWith('/')
  return async (argv) => {
    if (argv[option] && argv[option].length > 0) {
      if (argv[option].length === 1 && argv[option][0] === false) return argv

      const values = argv[option].filter(isGlob)
      if (values.length === 0) {
        return argv
      }
      const paths = await globby(values, {
        cwd: cwd === 'cwd' ? process.cwd() : rootDirectory,
        onlyDirectories: true,
        absolute: true,
        expandDirectories: false,
      })
      if (paths.length === 0) {
        throw new Error(`could not find any package in any of ${argv[option].join(',')}`)
      }

      for (const filepath of paths) {
        if (!fs.existsSync(path.join(filepath, 'package.json'))) {
          throw new Error(
            `${filepath} is not a valid package path, because package.json was not found in ${path.resolve(
              filepath,
            )}.`,
          )
        }
      }

      argv[option] = paths.concat(argv[option].filter((v) => !isGlob(v)))
    }

    return argv
  }
}

function supportDashUpto(argv) {
  const {upto} = argv

  if (upto && upto.length === 1 && upto[0] === false) {
    argv.upto = undefined
    delete argv.configUpto
  }

  return argv
}

/**
 * @param {string} option
 * @param {object} optionDefaults
 * @param {Map<string, string[]>} aggregateOptions
 * @param {Map<string, string>} inAggregateOptions
 * @returns {[string, import('yargs').Options]}
 */
function makeEnableOption(option, optionDefaults, aggregateOptions, inAggregateOptions) {
  return [
    option,
    {
      describe: aggregateOptions.has(option)
        ? `aggregages the ${aggregateOptions.get(option).join(',')} options`
        : `enables disables "${option}" when building`,
      group: 'Build options:',
      type: 'boolean',
      default: inAggregateOptions.has(option)
        ? undefined
        : optionDefaults[option] === undefined
        ? true
        : optionDefaults[option],
      defaultDescription: String(
        optionDefaults[option] === undefined ? true : optionDefaults[option],
      ),
    },
  ]
}

/**
 * @param {string} option
 * @param {object} optionDefaults
 * @returns {[string, import('yargs').Options]}
 */
function makeParameterOption(option, optionDefaults) {
  return [
    option,
    {
      group: 'Build options:',
      type: 'string',
      default: optionDefaults[option] === undefined ? undefined : optionDefaults[option],
      demandOption: option === 'message' ? true : false,
      alias: option === 'message' ? 'm' : undefined,
    },
  ]
}

/**
 * @param {import('@bilt/build-with-configuration/src/types').BuildConfiguration[]} buildConfigurationChain
 * @param {string} requestedJobId
 * @returns {import('@bilt/build-with-configuration/src/types').Job}
 */
function findJobConfigurationInChain(buildConfigurationChain, requestedJobId) {
  for (const buildConfiguration of buildConfigurationChain) {
    for (const [jobId, jobConfiguration] of Object.entries(buildConfiguration.jobs)) {
      if (jobId === requestedJobId) {
        return jobConfiguration
      }
    }
  }
  throw new Error(`could not find job ${requestedJobId}`)
}

module.exports = main
