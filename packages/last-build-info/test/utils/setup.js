const fs = require('fs')
const os = require('fs')
const path = require('path')
const {exec, execFile} = require('child_process')
const {promisify: p} = require('util')
const cpr = require('cpr')
const {executeCommand} = require('@bilt/host-agent')

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
  // gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')), // TODO

  await executeCommand({
    command: ['git', 'push', '--set-upstream', 'origin', 'master'],
    cwd: buildDir,
  })
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
