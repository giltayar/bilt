'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const assert = require('assert')
const debug = require('debug')('bilt:bilt-cli')
const childProcess = require('child_process')
const {promisify: p} = require('util')
const makeDir = require('make-dir')
const gitRepoInfo = require('git-repo-info')
const union = require('set-union')
const ignore = require('ignore')
const {git: {findChangedFiles: gitFindChangedFiles}} = require('jest-changed-files')

async function readLastBuildInfo(directory) {
  const packages = await scanDirectoriesWithBiltJson(directory)
  const ret = []
  for (const packageDirectory of packages) {
    ret.push({packageDirectory, ...readBiltJson(packageDirectory)})
  }

  return ret

  async function readBiltJson(packageDirectory) {
    // {commit, changedFilesInWorkspace}
    try {
      return JSON.parse(await p(fs.readFile)(path.join(packageDirectory, 'bilt.json')))
        .lastSuccessfulBuild
    } catch (err) {
      if (err.code === 'ENOEXIST') {
        return undefined
      } else if (err.code === 'ENOENT') {
        return undefined
      } else if (err instanceof SyntaxError) {
        console.error('Could not parse .bilt/last-build.json. Building all.')
        return undefined
      }
      throw err
    }
  }
}

async function findChangesInCurrentRepo(directory) {
  return {
    commit: gitRepoInfo(directory).sha,
    changedFilesInWorkspace: await readHashesOfFiles(
      directory,
      await filterBybiltIgnore(
        directory,
        gitRepoInfo(directory).sha ? await gitFindChangedFiles(directory) : [],
      ),
    ),
  }
}

async function calculateFilesChangedSinceLastBuild(directory, lastBuildInfo, currentRepoInfo) {
  if (lastBuildInfo.commit === currentRepoInfo.commit) {
    return determineChangedFiles(
      currentRepoInfo.changedFilesInWorkspace,
      lastBuildInfo.changedFilesInWorkspace,
    )
  }
  const filesChanged = []

  for (const packageInfo of lastBuildInfo) {
    const {commit, changedFilesInWorkspace} = packageInfo

    const filesChangedSinceLastSuccesfulBuild = filesChangedFromCommitToCommit(
      directory,
      commit,
      currentRepoInfo.commit,
    )

    filesChangedSinceLastSuccesfulBuild.forEach(f => filesChanged.push(f))

    for (const {file, hash} of changedFilesInWorkspace) {
      if (await changedInCurrentDirecory(file, hash, currentRepoInfo.changedFilesInWorkspace)) {
        filesChanged.push(file)
      }
    }
  }

  for (const {file, hash} of currentRepoInfo.changedFilesInWorkspace) {
    filesChanged.push(file)
  }

  return filesChanged
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
      .on('error', err => (err.code === 'ENOENT' ? resolve('<deleted>') : reject(err)))
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

async function filterBybiltIgnore(directory, files) {
  return (await Promise.all(
    files.map(async file => await filterFileBybiltIgnore(directory, file)),
  )).filter(f => !!f)
}

async function filterFileBybiltIgnore(directory, file) {
  const ignoreMask = await findbiltIgnorePattern(directory, file)

  return ignoreMask.ignores(file) ? undefined : file
}

async function findbiltIgnorePattern(directory, file) {
  const ignoreMask = ignore()
  for (const dir of directoriesBetween(directory, file)) {
    try {
      ignoreMask.add(await p(fs.readFile)(path.join(dir, '.biltignore'), {encoding: 'utf-8'}))
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }

  return ignoreMask
}

function directoriesBetween(directory, file) {
  assert(file.startsWith(directory))

  const fileDirectory = path.dirname(file)

  const missingSegments = fileDirectory.slice(directory.length + 1).split('/')

  return missingSegments.reduce(
    (directories, segment) =>
      directories.concat(path.join(directories[directories.length - 1], segment)),
    [directory],
  )
}

module.exports = {
  readLastBuildInfo,
  saveLastBuildInfo,
  findChangesInCurrentRepo,
  calculateFilesChangedSinceLastBuild,
}
