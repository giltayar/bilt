'use strict'
const path = require('path')
const fs = require('fs')
const yargs = require('yargs')
const {cosmiconfig} = require('cosmiconfig')

async function main(argv, {shouldExitOnError = false} = {}) {
  const commandLineOptions = yargs
    .command(['build <packages...>', '* <packages...>'], 'build the packages', (yargs) =>
      yargs
        .option('dry-run', {
          describe: 'just show what packages will be built and in what order',
          type: 'boolean',
          default: false,
        })
        .option('message', {
          describe: 'commit message for the build',
          type: 'string',
        })
        .option('upto', {
          describe: 'packages to build up to',
          type: 'string',
          array: 'true',
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

  const {rootDirectory} = await loadConfigFile()

  await require(`./command-${command}`)({rootDirectory, ...args})
}

async function loadConfigFile() {
  const explorer = cosmiconfig('bilt')

  const result = await explorer.search()
  if (result == null) throw new Error('could not find `.bilt-applitoolsrc` config file')

  return {rootDirectory: result.filepath}
}

module.exports = main
