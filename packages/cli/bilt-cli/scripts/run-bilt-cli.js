'use strict'
const yargs = require('yargs')
const biltHere = require('../src/bilt-cli')

process.on('unhandledRejection', err => {
  console.log(err.stack || err)
  process.exit(2)
})

const argv = yargs
  .env('BILT_OPTIONS')
  .version()
  .option('build', {
    alias: 'b',
    description: 'directory or artifact name to build. It will build just this artifact',
    array: true,
    default: '.',
  })
  .option('all', {
    alias: 'a',
    description: 'look in parent folders for a .bilt folder, and build all artifacts there',
    boolean: true,
    default: false,
    conflicts: 'build',
  })
  .option('root', {
    alias: 'r',
    description: 'directory or artifact name to build, including its dependencies and dependees',
    array: true,
  })
  .option('upto', {
    alias: 'u',
    description: 'directory or artifact name to build, including its dependees',
    array: true,
  })
  .options('force', {
    alias: 'f',
    description: 'force builds, whether it is needed or not',
    boolean: true,
    default: false,
  })
  .options('execute', {
    alias: '-',
    description: 'executes the following command on the artifacts instead of building them',
    array: true,
  })

biltHere(args[0], args[1]).catch(err => console.log(err.stack || err))
