#!/usr/bin/env node
'use strict'
const yargs = require('yargs')
const biltHere = require('../src/bilt-cli')
const isCi = require('is-ci')

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
  .options('ci', {
    alias: 'c',
    default: isCi,
    description: 'force formal build',
  })
  .options('source-changes-pushed', {
    alias: 'p',
    default: !isCi,
    description: 'are build changes to source going to be pushed',
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
  })
  .options('dry-run', {
    alias: 'e',
    description: 'only show packages in build order',
    array: false,
    boolean: true,
  }).argv

async function main() {
  const buildDirectory = argv.repoDirectory || process.cwd()

  const retCode = await biltHere(buildDirectory, {
    upto: argv.upto,
    from: argv.root,
    justBuild: argv.build,
    force: argv.force,
    repository: argv.checkout,
    rebuild: argv.rebuild,
    enableSteps: argv.enable,
    dryRun: argv.dryRun,
    isFormalBuild: argv.ci,
    disableSteps: (argv.disable || []).filter(step => !(argv.enable || []).includes(step)),
  })

  process.exit(retCode)
}

main().catch(err => console.log(err.stack || err))
