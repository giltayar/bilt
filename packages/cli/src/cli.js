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
    .config('config', function (configpath) {
      if (configpath.includes('<no-biltrc-found>')) {
        throw new Error('no ".biltrc" found')
      }

      const {config} = explorer.load(configpath)

      if (!config.configUpto && config.upto) {
        config.configUpto = config.upto
      }
      delete config.upto

      return config
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
    .command(
      ['build [packagesToBuild..]', '* [packagesToBuild..]'],
      'build the packages',
      (yargs) => {
        let yargsAfterOptions = yargs
          .positional('packagesToBuild', {
            describe:
              'list of packages to build. Use "*" or leave empty to autofind packages in cwd',
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
          .option('no-upto', {
            alias: 'n',
            type: 'string',
            boolean: true,
            describe: 'disable upto, even if configured in .biltrc',
          })
          .option('packages', {
            describe: 'the set of all packages to take into consideration',
            type: 'string',
            array: true,
            hidden: true,
          })
          .option('configUpto', {
            type: 'string',
            array: true,
            hidden: true,
          })

        for (const specificBuildOption of BUILD_OPTIONS) {
          yargsAfterOptions = yargsAfterOptions.option(...buildOption(specificBuildOption))
        }
        return yargsAfterOptions
          .option(...buildOption('git', 'no-git disables push/pull/commit'))
          .middleware(applyGitOption)
          .middleware(supportDashUpto)
          .middleware(setupPackages('packagesToBuild', 'cwd'))
          .middleware(setupPackages('packages', 'configpath'))
          .middleware(setupPackages('upto', 'cwd'))
          .middleware(setupPackages('configUpto', 'configpath'))
      },
    )
    .exitProcess(shouldExitOnError)
    .strict()
    .help()

  const {_: [command = 'build'] = [], config, ...args} = await commandLineOptions.parse()
  if (args.configUpto) {
    args.upto = args.configUpto
    delete args.configUpto
  }

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
 * @param {'cwd'|'configpath'} cwd
 */
function setupPackages(option, cwd) {
  /**
   * @param {string} v
   */
  const isGlob = (v) => v.startsWith('.') || v.startsWith('/')
  return async (argv) => {
    if (argv[option] && argv[option].length > 0) {
      if (argv[option].length === 1 && argv[option][0] === false) return argv

      const values = argv[option].filter(isGlob)
      if (values.length === 0) {
        return argv
      }
      const paths = await globby(values, {
        cwd: cwd === 'cwd' ? process.cwd() : path.dirname(argv.config),
        onlyDirectories: true,
        absolute: true,
        expandDirectories: false,
      })
      if (paths.length === 0) {
        throw new Error(`could not find any package in any of ${argv[option].join(',')}`)
      }

      for (const filepath of paths) {
        if (!fs.existsSync(path.join(filepath, 'package.json'))) {
          throw new Error(
            `${filepath} is not a valid package path, because package.json was not found in ${path.resolve(
              filepath,
            )}.`,
          )
        }
      }

      argv[option] = paths.concat(argv[option].filter((v) => !isGlob(v)))
    }

    return argv
  }
}

function supportDashUpto(argv) {
  const {upto} = argv

  if (upto && upto.length === 1 && upto[0] === false) {
    argv.upto = undefined
    delete argv.configUpto
  }

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
