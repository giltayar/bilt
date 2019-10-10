'use strict'
const fs = require('fs')
const path = require('path')
const {exec, execFile} = require('child_process')
const {promisify: p} = require('util')
const {expect} = require('chai')
const cpr = require('cpr')
const {executeCommand} = require('@bilt/host-agent')
const {setupGit} = require('./git-utils')

async function setupBuildDir(
  sourceDirectoryOfCommits,
  originForInitialPush = undefined,
  finalOrigin = undefined,
  keysDir,
  modifyBuildDirFunc,
) {
  // This folder needs to be mounted on docker, so we can't use `os.tmpdir`.
  const tmpDir = await p(fs.mkdtemp)(path.join(__dirname, '/test-resources/'))

  const gitEnvOverrides = await setupGit(keysDir, 'f@f.com', 'f')
  process.env = {...process.env, ...gitEnvOverrides}

  await gitInit(tmpDir)

  const commitsToReplay = await findCommitsToReplayInDirectory(sourceDirectoryOfCommits)

  for (const commitDirectory of commitsToReplay) {
    await replayCommit(tmpDir, commitDirectory)
  }
  if (modifyBuildDirFunc) {
    await modifyBuildDirFunc(tmpDir)

    await p(execFile)('git', ['add', '.'], {cwd: tmpDir})
    await p(execFile)('git', ['commit', '-am', 'modifications...'], {cwd: tmpDir})
  }

  if (originForInitialPush) {
    await p(execFile)('git', ['remote', 'add', 'origin', originForInitialPush], {cwd: tmpDir})

    await pushOrigin(tmpDir, gitEnvOverrides)
  }
  if (finalOrigin) {
    await p(execFile)('git', ['remote', 'set-url', 'origin', finalOrigin], {cwd: tmpDir})
  }

  return tmpDir
}

async function adjustNpmRegistryInfoInRepo(buildDir, npmRegistryAddress) {
  process.env.npm_config_registry = `http://${npmRegistryAddress}`

  for (const subDir of await p(fs.readdir)(buildDir)) {
    if (subDir.startsWith('.')) continue
    const packageDir = path.join(buildDir, subDir)
    if ((await p(fs.stat)(packageDir)).isDirectory()) {
      await p(fs.writeFile)(
        path.join(packageDir, '.npmrc'),
        `//${npmRegistryAddress}/:_authToken="dummy-token-because-npm-needs-to-have-one-even-foranonymous-publishing"
registry=http://${npmRegistryAddress}
`,
      )
    }
  }
}

async function pushOrigin(buildDir) {
  await executeCommand({
    command: ['git', 'push', '--set-upstream', 'origin', 'master'],
    cwd: buildDir,
    env: process.env,
  })
}

async function findCommitsToReplayInDirectory(directory) {
  const possibleCommitsToReplay = (await p(fs.readdir)(directory)).map(entry =>
    path.join(directory, entry),
  )

  const commitsToReplay = (await Promise.all(
    possibleCommitsToReplay.map(async cr =>
      (await p(fs.stat)(cr)).isDirectory() ? cr : undefined,
    ),
  )).filter(cr => !!cr)

  commitsToReplay.sort()

  return commitsToReplay
}

async function gitInit(directory) {
  await p(exec)('git init', {cwd: directory})
}

async function replayCommit(directory, commitDirectory) {
  await p(cpr)(commitDirectory + '/', directory, {overwrite: true})

  const commitMessage = path.basename(commitDirectory)

  await p(execFile)('git', ['add', '.'], {cwd: directory})
  await p(execFile)('git', ['commit', '-am', commitMessage], {cwd: directory})
}

async function setupFolder(sourceDirectory) {
  const tmpDir = await p(fs.mkdtemp)('/tmp/')

  await p(cpr)(sourceDirectory + '/', tmpDir, {overwrite: true})

  return tmpDir
}

async function checkVersionExists(pkg, version, npmRegistryAddress) {
  const {stdout} = await p(execFile)('npm', [
    'view',
    `${pkg}@${version}`,
    '--json',
    '--registry',
    `http://${npmRegistryAddress}/`,
  ])

  const packageInfo = JSON.parse(stdout)
  expect(packageInfo['dist-tags'].latest).to.equal(version)
}

module.exports = {
  setupFolder,
  setupBuildDir,
  checkVersionExists,
  adjustNpmRegistryInfoInRepo,
}
