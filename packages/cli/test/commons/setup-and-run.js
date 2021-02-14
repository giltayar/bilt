import {promises} from 'fs'
import {promisify} from 'util'
import {basename, join, resolve} from 'path'
import {execFile} from 'child_process'
import {init, commitAll} from '@bilt/git-testkit'
import {startNpmRegistry, enablePackageToPublishToRegistry} from '@bilt/npm-testkit'
import {
  makeTemporaryDirectory,
  readFileAsString,
  readFileAsJson,
  writeFile,
  sh,
} from '@bilt/scripting-commons'
import {main as cli} from '../../src/cli.js'
import {fileURLToPath, URL} from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 * @param {string} cwd
 * @param {string} [registry]
 */
export async function createAdepsBdepsCPackages(cwd, registry = undefined, base = '.') {
  if (registry) {
    await enablePackageToPublishToRegistry(cwd, registry)
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

/**
 * @param {string} cwd
 * @param {string|undefined} registry
 * @param {string} aPackageDir
 * @param {string} bPackageDir
 * @param {string} cPackageDir
 */
export async function createPackages(cwd, registry, aPackageDir, bPackageDir, cPackageDir) {
  const aPackage = basename(aPackageDir)
  const bPackage = basename(bPackageDir)
  const cPackage = basename(cPackageDir)
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
    await enablePackageToPublishToRegistry(join(cwd, aPackageDir), registry)
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
    await enablePackageToPublishToRegistry(join(cwd, bPackageDir), registry)
  }
  await writeFile([bPackageDir, 'build-count'], '0', {cwd})
  if (registry) {
    await sh('npm publish', {cwd: join(cwd, bPackageDir)})
  }

  const cPackageJson = {name: `${cPackage}-package`, version: '3.0.0', scripts: {build}}
  await writeFile([cPackageDir, 'package.json'], cPackageJson, {cwd})
  if (registry) {
    await enablePackageToPublishToRegistry(join(cwd, cPackageDir), registry)
  }
  await writeFile([cPackageDir, 'build-count'], '0', {cwd})
  if (registry) {
    await sh('npm publish', {cwd: join(cwd, cPackageDir)})
  }
  return {cPackageJson, bPackageJson}
}

export async function prepareGitAndNpm() {
  const cwd = await makeTemporaryDirectory()
  const pushTarget = await makeTemporaryDirectory()
  await init(pushTarget, {bare: true})
  await init(cwd, {origin: pushTarget})
  const {registry} = await startNpmRegistry()

  await enablePackageToPublishToRegistry(cwd, registry)
  await writeFile(['.biltrc.json'], {}, {cwd})
  return {registry, cwd, pushTarget}
}

/**
 * @param {string} buildConfigurationName
 * @param {{[x: string]: any}} [moreBuiltRc]
 */
export async function prepareForSimpleBuild(buildConfigurationName, moreBuiltRc) {
  const cwd = await makeTemporaryDirectory()
  await init(cwd)

  await writeFile(
    '.biltrc.json',
    {jobs: resolve(__dirname, buildConfigurationName), ...moreBuiltRc},
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
export async function runBuild(
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
      ...(message ? ['-m', message] : []),
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
export async function runBuildCli(
  cwd,
  message = 'a message',
  packages = undefined,
  uptos = undefined,
) {
  return await promisify(execFile)(
    resolve(__dirname, '../../scripts/bilt.js'),
    [
      ...(packages && packages.length > 0 ? packages : []),
      '-m',
      message,
      ...(uptos && uptos.length > 0 ? ['--upto', ...uptos] : []),
    ],
    {cwd},
  )
}

/**
 * @param {string} cwd
 * @param {string} pkg
 * @param {string} scriptName
 * @returns {Promise<number>}
 */
export async function packageScriptCount(cwd, pkg, scriptName) {
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
export async function packageScriptTime(cwd, pkg, scriptName) {
  return (await promises.stat(join(cwd, pkg, `${scriptName}-count`))).mtime.getTime()
}

/**
 * @param {string} cwd
 * @param {string} scriptName
 * @returns {Promise<number>}
 */
export async function repoScriptCount(cwd, scriptName) {
  return parseInt(await readFileAsString([`${scriptName}-count`], {cwd}), 10)
}

/**
 * @param {any} cwd
 * @param {string} pkg
 * @param {string} scriptName
 * @param {any} script
 */
export async function setNpmScript(cwd, pkg, scriptName, script) {
  /**@type {any} */
  const packageJson = await readFileAsJson([pkg, 'package.json'], {cwd})

  packageJson.scripts = packageJson.scripts || {}
  packageJson.scripts[scriptName] = script

  await writeFile([pkg, 'package.json'], packageJson, {cwd})
}
