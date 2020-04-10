'use strict'
const path = require('path')
const fs = require('fs')
const yargs = require('yargs')
const {cosmiconfigSync} = require('cosmiconfig')

async function main(argv, {shouldExitOnError = false} = {}) {
  const commandLineOptions = yargs
    .option('config', {
      alias: 'c',
      describe: 'config that shows where root dir is',
      type: 'string',
    })
    .command(['build [packages...]', '* [packages...]'], 'build the packages', (yargs) =>
      yargs
        .normalize('packages')
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
          describe: 'packages to build up to',
          type: 'string',
          array: true,
          normalize: true,
        })
        .middleware(determineConfig)
        .middleware(setupPackages('packages'))
        .middleware(setupPackages('upto')),
    )
    .exitProcess(shouldExitOnError)
    .strict()
    .help()

  const {_: [command = 'build'] = [], ...args} = commandLineOptions.parse(argv)

  await require(`./command-${command}`)({rootDirectory: path.dirname(args.config), ...args})
}

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

module.exports = main
