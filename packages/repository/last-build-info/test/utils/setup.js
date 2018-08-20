const fs = require('fs')
const os = require('fs')
const path = require('path')
const {exec, execFile} = require('child_process')
const {promisify: p} = require('util')
const cpr = require('cpr')
const pluginImport = require('plugin-import')

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
        events: '@bilt/in-memory-events',
        'agent:local-just-for-git-push': '@bilt/host-agent',
        'git-commander-just-for-git-push': {
          package: '@bilt/git-commander',
          gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
          gitUserEmail: 'gil@tayar.org',
          gitUserName: 'Gil Tayar',
        },
      },
    ],
    {
      baseDirectory: buildDir,
      useThisRequire: require,
    },
  )

  const localAgent = await pimport('agent:local-just-for-git-push')
  const gitCommander = await pimport('git-commander-just-for-git-push')
  const agentInstance = await localAgent.acquireInstanceForJob()
  try {
    const gitCommanderSetup = await gitCommander.setup({agentInstance})
    const transform = command =>
      gitCommander.transformAgentCommand(command, {setup: gitCommanderSetup})

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
  const tmpDir = await p(fs.mkdtemp)(os.tmpdir() + '/')

  await p(cpr)(sourceDirectory + '/', tmpDir, {overwrite: true})

  return tmpDir
}

module.exports = {
  setupFolder,
  setupBuildDir,
}
