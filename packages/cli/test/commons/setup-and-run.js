'use strict'
const fs = require('fs')
const {promisify} = require('util')
const path = require('path')
const {execFile} = require('child_process')
const {init, commitAll} = require('@bilt/git-testkit')
const {startNpmRegistry} = require('@bilt/npm-testkit')
const {makeTemporaryDirectory, readFileAsString, writeFile, sh} = require('@bilt/scripting-commons')
const cli = require('../../src/cli')

async function createAdepsBdepsCPackages(cwd, registry, base = '.') {
  if (registry) {
    await writeFile('.npmrc', `registry=${registry}\n`, {cwd})
  }
  const {cPackageJson, bPackageJson} = await createPackages(
    cwd,
    registry,
    `${base}/a`,
    `${base}/b`,
    `${base}/c`,
  )
  return {cPackageJson, bPackageJson}
}

async function createPackages(cwd, registry, aPackageDir, bPackageDir, cPackageDir) {
  const aPackage = path.basename(aPackageDir)
  const bPackage = path.basename(bPackageDir)
  const cPackage = path.basename(cPackageDir)
  const build = `echo $(expr $(cat build-count) + 1) >build-count`
  await writeFile(
    [aPackageDir, 'package.json'],
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
  await writeFile([aPackageDir, 'build-count'], '0', {cwd})
  if (registry) {
    await writeFile([aPackageDir, '.npmrc'], `registry=${registry}\n`, {cwd})
  }
  const bPackageJson = {
    name: `${bPackage}-package`,
    version: '2.0.0',
    dependencies: {[`${cPackage}-package`]: '^3.0.0'},
    scripts: {
      test: `cp node_modules/${cPackage}-package/package.json ./${cPackage}-package.json`,
      build,
    },
  }
  await writeFile([bPackageDir, 'package.json'], bPackageJson, {cwd})
  if (registry) {
    await writeFile([bPackageDir, '.npmrc'], `registry=${registry}\n`, {cwd})
  }
  await writeFile([bPackageDir, 'build-count'], '0', {cwd})
  if (registry) {
    await sh('npm publish', {cwd: path.join(cwd, bPackageDir)})
  }

  const cPackageJson = {name: `${cPackage}-package`, version: '3.0.0', scripts: {build}}
  await writeFile([cPackageDir, 'package.json'], cPackageJson, {cwd})
  if (registry) {
    await writeFile([cPackageDir, '.npmrc'], `registry=${registry}\n`, {cwd})
  }
  await writeFile([cPackageDir, 'build-count'], '0', {cwd})
  if (registry) {
    await sh('npm publish', {cwd: path.join(cwd, cPackageDir)})
  }
  return {cPackageJson, bPackageJson}
}

async function prepareGitAndNpm() {
  const cwd = await makeTemporaryDirectory()
  const pushTarget = await makeTemporaryDirectory()
  await init(pushTarget, {bare: true})
  await init(cwd, {origin: pushTarget})
  const {registry} = await startNpmRegistry()

  await writeFile('.npmrc', `registry=${registry}\n`, {cwd})
  await writeFile(['.biltrc.json'], {}, {cwd})
  return {registry, cwd, pushTarget}
}

/**
 * @param {string} buildConfigurationName
 * @param {{[x: string]: any}} [moreBuiltRc]
 */
async function prepareForSimpleBuild(buildConfigurationName, moreBuiltRc) {
  const cwd = await makeTemporaryDirectory()
  await init(cwd)

  await writeFile(
    '.biltrc.json',
    {jobs: path.resolve(__dirname, buildConfigurationName), ...moreBuiltRc},
    {cwd},
  )

  await writeFile('before1-count', '0', {cwd})
  await writeFile('after1-count', '0', {cwd})

  await commitAll(cwd, 'first commit')

  return cwd
}

/**
 * @param {string} cwd
 * @param {string} [message]
 * @param {string[]} [packages]
 * @param {string[]} [uptos]
 * @param {string[]} [moreArgs]
 * @param {string} [jobId]
 */
async function runBuild(
  cwd,
  message,
  packages = undefined,
  uptos = undefined,
  moreArgs = [],
  jobId,
) {
  const currentDir = process.cwd()
  try {
    process.chdir(cwd)
    await cli([
      ...(jobId === undefined ? [] : [jobId]),
      ...(packages && packages.length > 0 ? packages : []),
      '-m',
      message,
      ...(uptos && uptos.length > 0 ? ['--upto', ...uptos] : []),
      ...moreArgs,
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

/**
 * @param {string} cwd
 * @param {string} pkg
 * @param {string} scriptName
 * @returns {Promise<number>}
 */
async function packageScriptCount(cwd, pkg, scriptName) {
  return parseInt(
    await readFileAsString([pkg, `${scriptName}-count`], {cwd}).catch((err) =>
      err.code === 'ENOENT' ? '0' : Promise.reject(err),
    ),
    10,
  )
}

/**
 * @param {string} cwd
 * @param {string} pkg
 * @param {string} scriptName
 * @returns {Promise<number>}
 */
async function packageScriptTime(cwd, pkg, scriptName) {
  return (await fs.promises.stat(path.join(cwd, pkg, `${scriptName}-count`))).mtime.getTime()
}

/**
 * @param {string} cwd
 * @param {string} scriptName
 * @returns {Promise<number>}
 */
async function repoScriptCount(cwd, scriptName) {
  return parseInt(await readFileAsString([`${scriptName}-count`], {cwd}), 10)
}

module.exports = {
  prepareGitAndNpm,
  prepareForSimpleBuild,
  createAdepsBdepsCPackages,
  runBuild,
  runBuildCli,
  createPackages,
  packageScriptCount,
  repoScriptCount,
  packageScriptTime,
}
