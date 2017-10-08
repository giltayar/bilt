const fs = require('fs')
const path = require('path')
const {exec, execFile} = require('child_process')
const {promisify: p} = require('util')
const {expect} = require('chai')
const cpr = require('cpr')
const getNpmToken = require('get-npm-token')
const pluginImport = require('plugin-import')
const {fileContents, writeFile} = require('../utils/file-utils')

async function setupBuildDir(
  sourceDirectoryOfCommits,
  originForInitialPush = undefined,
  finalOrigin = undefined,
  modifyBuildDirFunc,
) {
  const tmpDir = await p(fs.mkdtemp)('/tmp/')

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

    await pushOrigin(tmpDir)
  }
  if (finalOrigin) {
    await p(execFile)('git', ['remote', 'set-url', 'origin', finalOrigin], {cwd: tmpDir})
  }

  return tmpDir
}

async function pushOrigin(buildDir) {
  const pimport = await pluginImport(
    [
      {
        events: '@bildit/in-memory-events',
        'agent:local-just-for-git-push': '@bildit/host-agent',
        'git-agent-commander-just-for-git-push': {
          '@bildit/git-agent-commander': {
            gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
            gitUserEmail: 'gil@tayar.org',
            gitUserName: 'Gil Tayar',
            usedLocally: true,
          },
        },
      },
    ],
    {
      baseDirectory: buildDir,
    },
  )

  const localAgent = await pimport('agent:local-just-for-git-push')
  const gitAgentCommander = await pimport('git-agent-commander-just-for-git-push')
  const agentInstance = await localAgent.acquireInstanceForJob()
  try {
    const gitAgentCommanderSetup = await gitAgentCommander.setup({agentInstance})
    const transform = command =>
      gitAgentCommander.transformAgentCommand(command, {setup: gitAgentCommanderSetup})

    await localAgent.executeCommand(
      transform({
        agentInstance,
        command: ['git', 'push', '--set-upstream', 'origin', 'master'],
        cwd: buildDir,
      }),
    )
  } finally {
    localAgent.releaseInstanceForJob(agentInstance)
  }
}

async function findCommitsToReplayInDirectory(directory) {
  const possibleCommitsToReplay = (await p(fs.readdir)(directory)).map(entry =>
    path.join(directory, entry),
  )

  const commitsToReplay = (await Promise.all(
    possibleCommitsToReplay.map(
      async cr => ((await p(fs.stat)(cr)).isDirectory() ? cr : undefined),
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

async function adjustNpmRegistryInfoInRepo(
  buildDir,
  hostNpmRegistryAddress,
  networkNpmRegistryAddress = hostNpmRegistryAddress,
) {
  const npmToken = await p(getNpmToken)(
    `http://${hostNpmRegistryAddress}/`,
    'npm-user',
    'gil@tayar.org',
    'npm-user-password',
  )
  const bilditRc = await fileContents(buildDir, 'bildit.config.js')

  const modifiedBilditRc = bilditRc
    .replace(/localhost\:4873/g, networkNpmRegistryAddress)
    .replace('NPM_TOKEN', npmToken)

  await writeFile(modifiedBilditRc, buildDir, 'bildit.config.js')
}

async function checkVersionExists(pkg, version, npmRegistryAddress) {
  const {stdout} = await p(execFile)('npm', [
    'view',
    `${pkg}@${version}`,
    '--registry',
    `http://${npmRegistryAddress}/`,
  ])

  expect(stdout).to.include(version)
}

module.exports = {
  setupFolder,
  setupBuildDir,
  adjustNpmRegistryInfoInRepo,
  checkVersionExists,
}
