'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const childProcess = require('child_process')
const {promisify: p} = require('util')
const makeDir = require('make-dir')
const gitRepoInfo = require('git-repo-info')
const union = require('set-union')
const {git: {findChangedFiles: gitFindChangedFiles}} = require('jest-changed-files')

async function readLastBuildInfo(directory) {
  try {
    return JSON.parse(await p(fs.readFile)(path.join(directory, '.bildit/last-build.json')))
  } catch (err) {
    if (err.code === 'ENOEXIST') {
      return undefined
    } else if (err.code === 'ENOENT') {
      return undefined
    } else if (err instanceof SyntaxError) {
      console.error('Could not parse .bildit/last-build.json. Building all.')
      return undefined
    }
    throw err
  }
}

async function saveLastBuildInfo(directory, currentRepoInfo) {
  await makeDir(path.join(directory, '.bildit'))

  await p(fs.writeFile)(
    path.join(directory, '.bildit/last-build.json'),
    JSON.stringify(currentRepoInfo, undefined, 2),
  )
}

async function findChangesInCurrentRepo(directory) {
  return {
    commit: gitRepoInfo(directory).sha,
    changedFilesInWorkspace: await readHashesOfFiles(
      directory,
      await gitFindChangedFiles(directory),
    ),
  }
}

async function calculateFilesChangedSinceLastBuild(directory, lastBuildInfo, currentRepoInfo) {
  if (lastBuildInfo.commit === currentRepoInfo.commit) {
    return determineChangedFiles(
      currentRepoInfo.changedFilesInWorkspace,
      lastBuildInfo.changedFilesInWorkspace,
    )
  } else {
    const filesStillChangedFromLastBuild = await determineWhichFilesChangedSinceLastBuild(
      directory,
      lastBuildInfo.changedFilesInWorkspace,
    )

    return Array.from(
      union(
        union(
          new Set(filesStillChangedFromLastBuild),
          new Set(Object.keys(currentRepoInfo.changedFilesInWorkspace)),
        ),
        await filesChangedFromCommitToCommit(
          directory,
          lastBuildInfo.commit,
          currentRepoInfo.commit,
        ),
      ),
    )
  }
}

async function readHashesOfFiles(directory, files) {
  const hashAndFiles = await Promise.all(
    files.map(async file => [
      path.relative(directory, file),
      await readHashOfFile(path.resolve(directory, file)),
    ]),
  )

  return hashAndFiles.reduce(
    (obj, [file, hash]) => Object.assign(obj, {[file]: hash}),
    Object.create(null),
  )
}

async function readHashOfFile(file) {
  const md5Hash = crypto.createHash('md5').setEncoding('hex')
  return await new Promise((resolve, reject) =>
    fs
      .createReadStream(file)
      .pipe(md5Hash)
      .on('finish', function() {
        resolve(this.read())
      })
      .on('error', reject),
  )
}

function determineChangedFiles(currentFiles, lastBuildFiles) {
  const filesChangedFromLastBuild = Object.entries(currentFiles)
    .filter(([file, hash]) => !lastBuildFiles[file] || lastBuildFiles[file] !== hash)
    .map(([file]) => file)

  const filesDeletedFromLastBuild = Object.keys(lastBuildFiles).filter(file => !currentFiles[file])

  return filesChangedFromLastBuild.concat(filesDeletedFromLastBuild)
}

async function determineWhichFilesChangedSinceLastBuild(directory, changedFilesInWorkspace) {
  const newHashes = await readHashesOfFiles(directory, Object.keys(changedFilesInWorkspace))

  return determineChangedFiles(newHashes, changedFilesInWorkspace)
}

async function filesChangedFromCommitToCommit(directory, fromCommit, toCommit) {
  // git diff-tree --no-commit-id --name-only -r fromCommit toCommit
  return new Set(
    (await p(childProcess.execFile)(
      'git',
      ['diff-tree', '--no-commit-id', '--name-only', '-r', fromCommit, toCommit],
      {
        cwd: directory,
      },
    )).stdout
      .split('\n')
      .filter(l => !!l),
  )
}

module.exports = {
  readLastBuildInfo,
  saveLastBuildInfo,
  findChangesInCurrentRepo,
  calculateFilesChangedSinceLastBuild,
}
