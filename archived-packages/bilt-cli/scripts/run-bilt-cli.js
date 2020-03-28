#!/usr/bin/env node
'use strict'
const path = require('path')
const yargs = require('yargs')
const cosmiConfig = require('cosmiconfig')
const {
  build,
  addToDevelopmentList,
  removeFromDevelopmentList,
  listDevelopmentList,
  resetDevelopmentList,
} = require('../src/bilt-cli')
const isCi = require('is-ci')

process.on('unhandledRejection', err => {
  console.log(err.stack || err)
  process.exit(2)
})

const argv = yargs
  .version()
  .command('*', 'build', yargs =>
    yargs
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
        description:
          'directory or artifact name to build, including its dependencies and dependees',
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
        description: 'only show packages in build order',
        array: false,
        boolean: true,
      }),
  )
  .command('ls', 'list developed packages').argv

async function main() {
  const buildDirectory = process.cwd()

  const {fileConfig, filepath} = await cosmiConfig('bilt', {
    rcExtensions: true,
  }).search(buildDirectory)

  const finalRepositoryDirectory = path.dirname(filepath)

  const command = argv._[0]
  switch (command) {
    case undefined:
      const retCode = await build(finalRepositoryDirectory, fileConfig, {
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
    case 'ls':
      return await listDevelopmentList(finalRepositoryDirectory)
    case 'add':
      return await addToDevelopmentList(finalRepositoryDirectory, argv.packages)
    case 'remove':
      return await removeFromDevelopmentList(finalRepositoryDirectory, argv.packages)
    case 'reset':
      return await resetDevelopmentList(finalRepositoryDirectory, argv.packages)
  }
}

main().catch(err => console.log(err.stack || err))
