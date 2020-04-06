'use strict'
const path = require('path')
const fs = require('fs')
const yargs = require('yargs')
const {cosmiconfig} = require('cosmiconfig')

async function main(argv, {shouldExitOnError = false} = {}) {
  const commandLineOptions = yargs
    .command(['build <packages...>', '* <packages...>'], 'build the packages', (yargs) =>
      yargs
        .option('config', {
          alias: 'c',
          describe: 'config that shows where root dir is',
          type: 'string',
          normalize: true,
          coerce: (filepath) => {
            if (!fs.existsSync(filepath)) {
              throw new Error(`${filepath} is not a valid package path`)
            }

            return filepath
          },
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
          coerce: (filepath) => {
            if (!fs.existsSync(path.join(filepath, 'package.json')))
              throw new Error(`${filepath} is not a valid package path`)

            return filepath
          },
        }),
    )
    .exitProcess(shouldExitOnError)
    .strict()
    .help()

  const {_: [command = 'build'] = [], ...args} = commandLineOptions.parse(argv)

  const {rootDirectory} = await loadConfigFile(args.config)

  await require(`./command-${command}`)({rootDirectory, ...args})
}

/**@type {(config?: string) => Promise<{rootDirectory: string}>} */
async function loadConfigFile(config) {
  const explorer = cosmiconfig('bilt')

  const result = config ? await explorer.load(config) : await explorer.search()
  if (result == null) throw new Error('could not find `.bilt-applitoolsrc` config file')

  return {rootDirectory: path.dirname(result.filepath)}
}

module.exports = main
