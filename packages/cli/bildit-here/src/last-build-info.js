'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const childProcess = require('child_process')
const {promisify: p} = require('util')
const makeDir = require('make-dir')
const gitRepoInfo = require('git-repo-info')
const {git: {findChangedFiles: gitFindChangedFiles}} = require('jest-changed-files')

async function readLastBuildInfo(directory) {
  try {
    return JSON.parse(await p(fs.readFile)(path.join(directory, '.bildit/last-build.json')))
    // return {
    //   commit: undefined,
    //   changedFilesInWorkspace: {
    //     path: 'hash',
    //   },
    // }
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

async function findChangesInCurrentRepo(directory) {
  return {
    commit: gitRepoInfo().sha,
    changedFilesInWorkspace: await readHashesOfFiles(
      directory,
      await gitFindChangedFiles(directory),
    ),
  }
}

async function calculateChangesToBuildSinceLastBuild(directory, lastBuildInfo, currentRepoInfo) {
  return {
    changedFilesThatNeedBuild: determineChangedFiles(
      currentRepoInfo.changedFilesInWorkspace,
      lastBuildInfo.changedFilesInWorkspace,
    ),
    fromCommit: await findCommitAfter(directory, lastBuildInfo.commit),
  }
}

async function saveBuildInfo(directory, currentRepoInfo) {
  await makeDir(path.join(directory, '.bildit'))

  await p(fs.writeFile)(
    path.join(directory, '.bildit/last-build.json'),
    JSON.stringify(currentRepoInfo, undefined, 2),
  )
}

async function findCommitAfter(directory, commit) {
  try {
    const commitList = (await p(childProcess.exec)(`git rev-list "${commit}" HEAD`, {
      cwd: directory,
    })).stdout
      .split('\n')
      .filter(l => !!l)

    // This happens when there is only one commit
    if (commitList.length === 0) return undefined

    return commitList[commitList.length - 1]
  } catch (err) {
    if (err.stderr.includes('Invalid symmetric difference')) {
      console.error(
        `couldn't find the commit ${commit} from buildInfo. Building only changed files in workspace.`,
      )
      return undefined
    }
    throw err
  }
}

async function readHashesOfFiles(directory, files) {
  const hashAndFiles = await Promise.all(
    files.map(async file => [path.relative(directory, file), await readHashOfFile(file)]),
  )

  return hashAndFiles.reduce(
    (obj, [file, hash]) => Object.assign(obj, {[file]: hash}),
    Object.create(null),
  )
}

const md5Hash = crypto.createHash('md5').setEncoding('hex')

async function readHashOfFile(file) {
  return await new Promise((resolve, reject) =>
    fs
      .createReadStream(file)
      .pipe(md5Hash)
      .on('finish', () => {
        resolve(this.read())
      })
      .on('error', reject),
  )
}

function determineChangedFiles(currentFiles, lastBuildFiles) {
  return Object.entries(currentFiles)
    .filter(([file, hash]) => !lastBuildFiles[file] || lastBuildFiles[file].hash !== hash)
    .map(([file]) => file)
}

module.exports = {
  readLastBuildInfo,
  findChangesInCurrentRepo,
  calculateChangesToBuildSinceLastBuild,
  saveBuildInfo,
}
