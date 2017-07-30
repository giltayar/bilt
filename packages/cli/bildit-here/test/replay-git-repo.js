const fs = require('fs')
const path = require('path')
const os = require('os')
const {exec, execFile} = require('child_process')
const {promisify: p} = require('util')
const cpr = require('cpr')

module.exports = async function(directory) {
  const tmpDir = await p(fs.mkdtemp)(path.join(os.tmpdir(), 'replay-git-repo'))

  await gitInit(tmpDir)

  const commitsToReplay = await findCommitsToReplayInDirectory(directory)

  for (const commitDirectory of commitsToReplay) {
    await replayCommit(directory, commitDirectory)
  }

  return tmpDir
}

async function findCommitsToReplayInDirectory(directory) {
  debugger
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
  console.log('replayed dir', commitDirectory, 'on', directory)
}
