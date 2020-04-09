'use strict'
const path = require('path')
const fs = require('fs')
const yargs = require('yargs')
const {cosmiconfigSync} = require('cosmiconfig')

async function main(argv, {shouldExitOnError = false} = {}) {
  /**@type {string}*/ let rootDirectory

  const commandLineOptions = yargs
    .option('config', {
      alias: 'c',
      describe: 'config that shows where root dir is',
      type: 'string',
      normalize: true,
      coerce: (filepath) => {
        if (!fs.existsSync(filepath)) {
          throw new Error(`${filepath} is not a valid package path`)
        }

        setRootDirectory(filepath)

        return filepath
      },
    })
    .command(['build [packages...]', '* [packages...]'], 'build the packages', (yargs) =>
      yargs
        .normalize('packages')
        .coerce('packages', coercePackages(rootDirectory))
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
          coerce: coercePackages(rootDirectory),
        }),
    )
    .exitProcess(shouldExitOnError)
    .strict()
    .help()

  const {_: [command = 'build'] = [], ...args} = commandLineOptions.parse(argv)

  await require(`./command-${command}`)({rootDirectory, ...args})

  /**@type {(config?: string) => void */
  function setRootDirectory(config) {
    if (rootDirectory) return
    const explorer = cosmiconfigSync('bilt')

    const result = config ? explorer.load(config) : explorer.search()
    if (result == null) throw new Error('could not find `.bilt-applitoolsrc` config file')

    rootDirectory = path.dirname(result.filepath)
  }
}

/**
 * @param {string} rootDirectory
 */
function coercePackages(rootDirectory) {
  return (filepaths) => {
    for (const filepath of filepaths)
      if (!fs.existsSync(path.join(rootDirectory, filepath, 'package.json')))
        throw new Error(
          `${filepath} is not a valid package path, because package.json was not found in ${path.join(
            rootDirectory,
            filepath,
          )} (if you used --config, it should be the first option)`,
        )
    return filepaths
  }
}

module.exports = main
