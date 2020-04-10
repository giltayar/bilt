'use strict'
const path = require('path')
const fs = require('fs')
const yargs = require('yargs')
const {cosmiconfigSync} = require('cosmiconfig')

const BUILD_OPTIONS = [
  'pull',
  'push',
  'commit',
  'install',
  'update',
  'audit',
  'build',
  'test',
  'publish',
]

async function main(argv, {shouldExitOnError = false} = {}) {
  const commandLineOptions = yargs
    .option('config', {
      alias: 'c',
      describe: 'config that shows where root dir is',
      type: 'string',
    })
    .command(['build [packages...]', '* [packages...]'], 'build the packages', (yargs) => {
      let yargsAfterOptions = yargs
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
        .option('message', {
          alias: 'm',
          describe: 'commit message for the build',
          type: 'string',
        })
        .option('upto', {
          alias: 'u',
          describe: 'packages to build up to. Use "-" for no upto-s',
          type: 'string',
          array: true,
          normalize: true,
        })

      for (const specificBuildOption of BUILD_OPTIONS) {
        yargsAfterOptions = yargsAfterOptions.option(...buildOption(specificBuildOption))
      }
      return yargsAfterOptions
        .option(...buildOption('git', 'no-git disables push/pull/commit all at once'))
        .middleware(applyGitOption)
        .middleware(determineConfig)
        .middleware(setupPackages('packages'))
        .middleware(setupPackages('upto'))
    })
    .exitProcess(shouldExitOnError)
    .strict()
    .help()

  const {_: [command = 'build'] = [], config, upto, ...args} = commandLineOptions.parse(argv)

  const finalUpto = upto && /**@type {string[]}*/ (upto).length === 1 && upto[0] === '-' ? [] : upto

  await require(`./command-${command}`)({
    rootDirectory: path.dirname(/**@type {string}*/ (config)),
    upto: finalUpto,
    ...args,
  })
}

/**
 * @param {{ config: string }} argv
 */
function determineConfig(argv) {
  const {config} = argv
  if (config) {
    if (!fs.existsSync(argv.config)) {
      throw new Error(`Configuration file ${argv.config} does not exist`)
    }
  } else {
    const explorer = cosmiconfigSync('bilt')

    const result = config ? explorer.load(config) : explorer.search()
    if (result == null) throw new Error('could not find `.biltrc` config file')

    argv.config = result.filepath
  }

  return argv
}

function applyGitOption(argv) {
  if (argv.git === false) {
    argv.pull = false
    argv.commit = false
    argv.push = false
  }
  return argv
}

/**
 * @param {string} option
 */
function setupPackages(option) {
  return (argv) => {
    const rootDirectory = path.dirname(argv.config)

    if (argv[option]) {
      argv[option] = argv[option].map((filepath) => {
        if (!fs.existsSync(path.join(filepath, 'package.json'))) {
          throw new Error(
            `${filepath} is not a valid package path, because package.json was not found in ${path.resolve(
              filepath,
            )}.`,
          )
        }
        return path.relative(rootDirectory, filepath)
      })
    }

    return argv
  }
}

/**
 * @param {string} option
 * @param {string} [describe]
 * @returns {[string, import('yargs').Options]}
 */
function buildOption(option, describe) {
  return [
    option,
    {
      describe: describe || `enables disables "${option}" when building`,
      group: 'Build options:',
      type: 'boolean',
      default: true,
    },
  ]
}

module.exports = main
