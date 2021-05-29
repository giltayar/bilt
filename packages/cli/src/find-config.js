import {dirname} from 'path'
import yargs from 'yargs'
import {cosmiconfig} from 'cosmiconfig'

/**
 * @param {string[]} argv
 */
async function findConfig(argv) {
  const {config: configPath} = await yargs(argv)
    .option('config', {
      alias: 'c',
      type: 'string',
    })
    .help(false)
    .strict(false)
    .parseAsync()

  const {config, filepath} =
    /**@type {NonNullable<import('cosmiconfig/dist/types').CosmiconfigResult>}*/ (
      configPath ? await cosmiconfig('bilt').load(configPath) : await cosmiconfig('bilt').search()
    )

  return {config, rootDirectory: dirname(filepath)}
}

export default findConfig
