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

  const moduleName = 'bilt'
  const theCosmiConfig = cosmiconfig(moduleName, {
    searchPlaces: [
      `.${moduleName}rc`,
      `.${moduleName}rc.json`,
      `.${moduleName}rc.yaml`,
      `.${moduleName}rc.yml`,
      `.${moduleName}rc.js`,
      `.${moduleName}rc.cjs`,
      `${moduleName}.config.js`,
      `${moduleName}.config.cjs`,
      `.bilt/.${moduleName}rc`,
      `.bilt/.${moduleName}rc.json`,
      `.bilt/.${moduleName}rc.yaml`,
      `.bilt/.${moduleName}rc.yml`,
      `.bilt/.${moduleName}rc.js`,
      `.bilt/.${moduleName}rc.cjs`,
      `.bilt/${moduleName}.config.js`,
      `.bilt/${moduleName}.config.cjs`,
    ],
  })
  const result = /**@type {import('cosmiconfig/dist/types').CosmiconfigResult}*/ (
    configPath ? await theCosmiConfig.load(configPath) : await theCosmiConfig.search()
  )

  if (!result) {
    throw new Error('could not find .biltrc file')
  }
  const {config, filepath} = result

  return {config, rootDirectory: dirname(filepath)}
}

export default findConfig
