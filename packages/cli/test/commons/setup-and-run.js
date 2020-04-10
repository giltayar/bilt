const {promisify} = require('util')
const path = require('path')
const {execFile} = require('child_process')
const {init} = require('@bilt/git-testkit')
const {startNpmRegistry} = require('@bilt/npm-testkit')
const {makeTemporaryDirectory, writeFile, sh} = require('@bilt/scripting-commons')
const applitoolsBuild = require('../../src/cli')

async function createAdepsBdepsCPackages(cwd, registry) {
  await writeFile(['.biltrc.json'], {}, {cwd})
  await writeFile('.npmrc', `registry=${registry}\n`, {cwd})
  const {cPackageJson, bPackageJson} = await createPackages(cwd, registry, 'a', 'b', 'c')
  return {cPackageJson, bPackageJson}
}

async function createPackages(cwd, registry, aPackage, bPackage, cPackage) {
  const build = `echo $(expr $(cat build-count) + 1) >build-count`
  await writeFile(
    [aPackage, 'package.json'],
    {
      name: `${aPackage}-package`,
      version: '1.0.0',
      dependencies: {[`${bPackage}-package`]: '^2.0.0'},
      scripts: {
        test: `cp node_modules/${bPackage}-package/package.json ./${bPackage}-package.json`,
        build,
      },
    },
    {cwd},
  )
  await writeFile([aPackage, 'build-count'], '0', {cwd})
  await writeFile([aPackage, '.npmrc'], `registry=${registry}\n`, {cwd})
  const bPackageJson = {
    name: `${bPackage}-package`,
    version: '2.0.0',
    dependencies: {[`${cPackage}-package`]: '^3.0.0'},
    scripts: {
      test: `cp node_modules/${cPackage}-package/package.json ./${cPackage}-package.json`,
      build,
    },
  }
  await writeFile([bPackage, 'package.json'], bPackageJson, {cwd})
  await writeFile([bPackage, '.npmrc'], `registry=${registry}\n`, {cwd})
  await writeFile([bPackage, 'build-count'], '0', {cwd})
  await sh('npm publish', {cwd: path.join(cwd, bPackage)})
  const cPackageJson = {name: `${cPackage}-package`, version: '3.0.0', scripts: {build}}
  await writeFile([cPackage, 'package.json'], cPackageJson, {cwd})
  await writeFile([cPackage, '.npmrc'], `registry=${registry}\n`, {cwd})
  await writeFile([cPackage, 'build-count'], '0', {cwd})
  await sh('npm publish', {cwd: path.join(cwd, cPackage)})
  return {cPackageJson, bPackageJson}
}

async function prepareGitAndNpm() {
  const cwd = await makeTemporaryDirectory()
  const pushTarget = await makeTemporaryDirectory()
  await init(pushTarget, {bare: true})
  await init(cwd, {origin: pushTarget})
  const {registry} = await startNpmRegistry()
  return {registry, cwd, pushTarget}
}

/**
 * @param {string} cwd
 * @param {string} [message]
 * @param {string[]} [packages]
 * @param {string[]} [uptos]
 */
async function runBuild(cwd, message, packages = undefined, uptos = undefined) {
  const currentDir = process.cwd()
  try {
    process.chdir(cwd)
    await applitoolsBuild([
      ...(packages && packages.length > 0 ? packages : []),
      '-m',
      message,
      ...(uptos && uptos.length > 0 ? ['--upto', ...uptos] : []),
    ])
  } finally {
    process.chdir(currentDir)
  }
}

/**
 * @param {string} cwd
 * @param {string} [message]
 * @param {string[]} [packages]
 * @param {string[]} [uptos]
 */
async function runBuildCli(cwd, message, packages = undefined, uptos = undefined) {
  const {stdout} = await promisify(execFile)(
    path.resolve(__dirname, '../../scripts/bilt.js'),
    [
      ...(packages && packages.length > 0 ? packages : []),
      '-m',
      message,
      ...(uptos && uptos.length > 0 ? ['--upto', ...uptos] : []),
    ],
    {cwd},
  )

  return stdout
}

module.exports = {
  prepareGitAndNpm,
  createAdepsBdepsCPackages,
  runBuild,
  runBuildCli,
  createPackages,
}
