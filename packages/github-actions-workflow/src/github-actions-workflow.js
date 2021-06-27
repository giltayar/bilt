import yargs from 'yargs'
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
  return yargs(argv).command(
    '$0 <template-workflow-file>',
    'generate a github actions workflow that runs the Bilt',
    (yargs) =>
      yargs
        .positional('template-workflow-file', {
          describe:
            'the workflow template file (YAML) that generates the github action workflow file',
          type: 'string',
          demandOption: true,
        })
        .option('bilt-options', {
          type: 'string',
          describe:
            'command line options to pass to bilt that is executed as part of the generateBuildInformation',
        }),
    generateCommand,
  )
}
