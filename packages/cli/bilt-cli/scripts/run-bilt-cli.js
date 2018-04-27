'use strict'
const yargs = require('yargs')
const biltHere = require('../src/bilt-cli')

process.on('unhandledRejection', err => {
  console.log(err.stack || err)
  process.exit(2)
})

const argv = yargs
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
  .command('* [repo-directory]', 'repo directory')
  .exitProcess(false)

async function main() {
  const repoDir = argv.argv._[0] || (await findRepoDir())
  const buildAll = argv.argv.all

  await biltHere(repoDir, {
    upto: buildAll ? undefined : (argv.argv.upto || []).concat(argv.argv.root || []),
    from: buildAll ? undefined : argv.argv.root,
    justBuild: buildAll ? undefined : argv.argv.build,
    force: argv.argv.force,
    repository: argv.argv.checkout,
  })
}

async function findRepoDir() {
  return '.'
}

main().catch(err => console.log(err.stack || err))
