'use strict'
const yargs = require('yargs')
const {cosmiconfig} = require('cosmiconfig')

async function main(argv, {shouldExitOnError = false} = {}) {
  const commandLineOptions = yargs
    .command(['build <packages...>', '* <packages...>'], 'build the packages', (yargs) =>
      yargs.option('dry-run', {
        describe: 'just show what packages will be built and in what order',
        type: 'boolean',
        default: false,
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
  const explorer = cosmiconfig('bilt-applitools')

  const result = await explorer.search()

  return {rootDirectory: result.filepath}
}

module.exports = main
