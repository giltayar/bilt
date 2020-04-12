'use strict'
const path = require('path')
const fs = require('fs')
const yargs = require('yargs')
const debug = require('debug')('bilt:cli:cli')
const {cosmiconfigSync} = require('cosmiconfig')
const globby = require('globby')

const BUILD_OPTIONS = [
  'pull',
  'push',
  'commit',
  'install',
  'update',
  'audit',
  'build',
  'test',
  'publish',
]

async function main(argv, {shouldExitOnError = false} = {}) {
  const explorer = cosmiconfigSync('bilt')

  const commandLineOptions = yargs(argv)
    .config('config', function (filepath) {
      if (filepath.includes('<no-biltrc-found>')) {
        throw new Error('no ".biltrc" found')
      }

      return explorer.load(filepath).config
    })
    .default('config', function () {
      const config = explorer.search()
      if (config) {
        return config.filepath
      } else {
        return '<no-biltrc-found>'
      }
    })
    .alias('c', 'config')
    .command(['build [packages..]', '* [packages..]'], 'build the packages', (yargs) => {
      let yargsAfterOptions = yargs
        .positional('packages', {
          describe:
            'list of base packages to build. Use "*" or leave empty to autofind packages in cwd',
          type: 'string',
          array: true,
        })
        .option('dry-run', {
          describe: 'just show what packages will be built and in what order',
          type: 'boolean',
          default: false,
        })
        .option('force', {
          alias: 'f',
          describe: 'force build of packages',
          type: 'boolean',
          default: false,
        })
        .option('message', {
          alias: 'm',
          describe: 'commit message for the build',
          type: 'string',
        })
        .option('upto', {
          alias: 'u',
          describe: 'packages to build up to. Use "-" for no upto-s',
          type: 'string',
          array: true,
        })

      for (const specificBuildOption of BUILD_OPTIONS) {
        yargsAfterOptions = yargsAfterOptions.option(...buildOption(specificBuildOption))
      }
      return yargsAfterOptions
        .option(...buildOption('git', 'no-git disables push/pull/commit'))
        .middleware(applyGitOption)
        .middleware(supportDashUpto)
        .middleware(setupPackages('packages', {atLeastOneDirectory: true}))
        .middleware(setupPackages('upto', {atLeastOneDirectory: false}))
    })
    .exitProcess(shouldExitOnError)
    .strict()
    .help()

  const {_: [command = 'build'] = [], config, ...args} = await commandLineOptions.parse()
  debug('final options', {...args, config})

  await require(`./command-${command}`)({
    //@ts-ignore
    rootDirectory: path.dirname(config),
    ...args,
  })
}

function applyGitOption(argv) {
  if (argv.git === false) {
    argv.pull = false
    argv.commit = false
    argv.push = false
  }
  return argv
}

/**
 * @param {string} option
 * @param {{atLeastOneDirectory: boolean}} options
 */
function setupPackages(option, {atLeastOneDirectory}) {
  /**
   * @param {string} v
   */
  const isGlob = (v) => v.startsWith('.') || v.startsWith('/')
  return async (argv) => {
    const rootDirectory = path.dirname(argv.config)

    if (argv[option] && argv[option].length > 0) {
      const values = argv[option].filter(isGlob)
      if (values.length === 0) {
        if (atLeastOneDirectory) {
          throw new Error(
            `none of the ${option} (${argv[option].join(
              ',',
            )}) was a directory. There must be at least one directory.
Maybe you forgot to prefix directories with "." or "/"?\n`,
          )
        }
        return argv
      }
      const paths = await globby(values, {
        cwd: process.cwd(),
        onlyDirectories: true,
        expandDirectories: false,
        markDirectories: true,
      })
      if (paths.length === 0) {
        throw new Error(`could not find any package in any of ${argv[option].join(',')}`)
      }
      argv[option] = paths
        .map((filepath) => {
          if (!fs.existsSync(path.join(filepath, 'package.json'))) {
            throw new Error(
              `${filepath} is not a valid package path, because package.json was not found in ${path.resolve(
                filepath,
              )}.`,
            )
          }
          return path.relative(rootDirectory, filepath)
        })
        .concat(argv[option].filter((v) => !isGlob(v)))
    }

    return argv
  }
}

function supportDashUpto(argv) {
  const {upto} = argv

  argv.upto = upto && upto.length === 1 && upto[0] === '-' ? [] : upto

  return argv
}

/**
 * @param {string} option
 * @param {string} [describe]
 * @returns {[string, import('yargs').Options]}
 */
function buildOption(option, describe) {
  return [
    option,
    {
      describe: describe || `enables disables "${option}" when building`,
      group: 'Build options:',
      type: 'boolean',
      default: true,
    },
  ]
}

module.exports = main
