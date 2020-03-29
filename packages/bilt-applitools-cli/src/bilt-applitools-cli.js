'use strict'
const yargs = require('yargs')

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

  await require(`./command-${command}`)(args)
}

module.exports = main
