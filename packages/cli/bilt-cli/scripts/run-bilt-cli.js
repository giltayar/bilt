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
  })
  .option('rebuild', {
    description: 'whether this is a rebuild (usually local) or not (usually CI)',
    boolean: true,
    default: true,
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
  const buildDirectory = argv.repoDirectory || '.'

  await biltHere(buildDirectory, {
    upto: argv.upto,
    from: argv.root,
    justBuild: argv.build,
    force: argv.force,
    repository: argv.checkout,
    rebuild: argv.rebuild,
    enabledSteps: argv.enable,
    disabledSteps: (argv.disable || []).filter(step => !(argv.enable || []).includes(step)),
  })
}

main().catch(err => console.log(err.stack || err))
