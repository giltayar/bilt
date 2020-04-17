'use strict'
const path = require('path')
const yargs = require('yargs')
const {cosmiconfig} = require('cosmiconfig')

async function findConfig(argv) {
  const {config: configPath} = yargs
    .option('config', {
      alias: 'c',
      type: 'string',
    })
    .parse(argv)

  const {filepath, config} = configPath
    ? await cosmiconfig('bilt').load(configPath)
    : await cosmiconfig('bilt').search()

  return {config, rootDirectory: path.dirname(filepath)}
}

module.exports = findConfig
