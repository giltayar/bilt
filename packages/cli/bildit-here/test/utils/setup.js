const fs = require('fs')
const path = require('path')
const {exec, execFile} = require('child_process')
const {promisify: p} = require('util')
const cpr = require('cpr')
const pluginRepoFactory = require('@bildit/config-based-plugin-repository')

async function setupBuildDir(
  sourceDirectoryOfCommits,
  originForInitialPush = undefined,
  finalOrigin = undefined,
) {
  const tmpDir = await p(fs.mkdtemp)(path.join(__dirname, 'temp-folders-for-docker') + '/')

  await gitInit(tmpDir)

  const commitsToReplay = await findCommitsToReplayInDirectory(sourceDirectoryOfCommits)

  for (const commitDirectory of commitsToReplay) {
    await replayCommit(tmpDir, commitDirectory)
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
  const pluginRepository = await pluginRepoFactory({
    directory: buildDir,
    defaultConfig: {
      plugins: {
        events: '@bildit/in-memory-events',
        'agent:local-just-for-git-push': '@bildit/host-agent',
        'vcs-just-for-git-push': {
          '@bildit/git-vcs': {
            gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
            gitUserEmail: 'gil@tayar.org',
            gitUserName: 'Gil Tayar',
            usedLocally: true,
          },
        },
      },
    },
  })

  const gitVcs = await pluginRepository.findPlugin('vcs-just-for-git-push')
  const localAgent = await pluginRepository.findPlugin('agent:local-just-for-git-push')
  const agentInstance = await localAgent.acquireInstanceForJob({repository: buildDir})
  try {
    await gitVcs.push({agent: localAgent, agentInstance})
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
  const tmpDir = await p(fs.mkdtemp)(path.join(__dirname, 'temp-folders-for-docker') + '/')

  await p(cpr)(sourceDirectory + '/', tmpDir, {overwrite: true})

  return tmpDir
}

module.exports = {
  setupFolder,
  setupBuildDir,
}
