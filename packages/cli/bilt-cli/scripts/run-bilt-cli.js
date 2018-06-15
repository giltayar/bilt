#!/usr/bin/env node
'use strict'
const yargs = require('yargs')
const biltHere = require('../src/bilt-cli')

process.on('unhandledRejection', err => {
  console.log(err.stack || err)
  process.exit(2)
})

const argv = yargs
  .version()
  .command('* [repo-directory]', 'repo directory')
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
  .options('checkout', {
    alias: 'c',
    description: 'checkout git repo',
  })
  .options('disable', {
    alias: 'd',
    description: 'disable step',
    array: true,
  })
  .options('enable', {
    alias: 'e',
    description: 'enable step',
    array: true,
  }).argv

async function main() {
  const buildDirectory = argv.repoDirectory || (await findRepoDir())

  const buildAll = argv.all

  await biltHere(buildDirectory, {
    upto: buildAll ? undefined : (argv.upto || []).concat(argv.root || []),
    from: buildAll ? undefined : argv.root,
    justBuild: buildAll ? undefined : argv.build,
    force: argv.force,
    repository: argv.checkout,
    enabledSteps: argv.enable,
    disabledSteps: (argv.disable || []).filter(step => !(argv.enable || []).includes(step)),
  })
}

async function findRepoDir() {
  return '.'
}

main().catch(err => console.log(err.stack || err))
