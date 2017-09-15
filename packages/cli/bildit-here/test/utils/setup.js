const fs = require('fs')
const path = require('path')
const os = require('os')
const {exec, execFile} = require('child_process')
const {promisify: p} = require('util')
const cpr = require('cpr')

async function setupGitRepo(sourceDirectoryOfCommits, origin, repoDir) {
  await gitInit(repoDir)

  const commitsToReplay = await findCommitsToReplayInDirectory(sourceDirectoryOfCommits)

  for (const commitDirectory of commitsToReplay) {
    await replayCommit(repoDir, commitDirectory)
  }

  if (origin) {
    await p(execFile)('git', ['remote', 'add', 'origin', origin], {cwd: repoDir})
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
  const tmpDir = await p(fs.mkdtemp)(
    path.join(os.tmpdir(), (Math.random() * 100000).toString().slice(6)),
  )

  await p(cpr)(sourceDirectory + '/', tmpDir, {overwrite: true})

  return tmpDir
}

module.exports = {
  setupFolder,
  setupGitRepo,
}
