import yargs from 'yargs'
import {echoBuildNeedCommands} from './commands/echo-build-needs-command.js'
import {generateCommand} from './commands/generate-command.js'

/**
 *
 * @param {string[]} argv
 * @param {{shouldExitOnError?: boolean}} options
 */
export async function app(argv, {shouldExitOnError = true} = {}) {
  const commandLineOptions = getCommandLineOptions(argv)

  await commandLineOptions.exitProcess(shouldExitOnError).strict().help().parse()
}

/**
 * @param {readonly string[]} argv
 */
function getCommandLineOptions(argv) {
  return yargs(argv)
    .command(
      '$0 [template-workflow-file]',
      'generate a github actions workflow that runs the Bilt',
      (/** @type {import('yargs').Argv} */ yargs) =>
        yargs
          .positional('template-workflow-file', {
            describe:
              'the workflow template file (YAML) that generates the github action workflow file',
            type: 'string',
          })
          .option('bilt-options', {
            type: 'string',
            describe:
              'command line options to pass to bilt that is executed as part of the generateBuildInformation',
          }),
      generateCommand,
    )
    .command(
      'echo-build-needs',
      'echo github action commands needed by github action workflow for bilt',
      (yargs) => yargs,
      echoBuildNeedCommands,
    )
}
