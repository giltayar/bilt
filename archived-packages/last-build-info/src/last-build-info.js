'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const assert = require('assert')
const childProcess = require('child_process')
const {promisify: p} = require('util')
const makeDir = require('make-dir')
const rimraf = require('rimraf')
const pickBy_ = require('lodash.pickby')
const gitRepoInfo = require('git-repo-info')
const ignore = require('ignore')
const {getChangedFilesForRoots} = require('jest-changed-files')

/**
 * @typedef {string} FileHash
 * @typedef {{name: string, path: string}} ArtifactInfo
 * @typedef {{name: string, path: string, lastSuccessfulBuild: {timestamp: string, commit: string, changedFilesInWorkspace: {[path: string]: FileHash}}}} ArtifactBuildInfo
 * @param {{repositoryDirectory: string, artifacts: ArtifactInfo[]}} options
 *
 * @typedef {ArtifactBuildInfo[]} LastBuildInfo
 * @returns {Promise<LastBuildInfo>}
 */
async function lastBuildInfo({repositoryDirectory, artifacts}) {
  return await Promise.all(
    artifacts.map(async artifact => {
      const biltJson = await readBiltJson(path.join(repositoryDirectory, '.bilt', artifact.path))

      return {
        name: artifact.name,
        path: artifact.path,
        ...biltJson,
      }
    }),
  )
}

/**
 *
 * @param {{repositoryDirectory: string, lastBuildInfo: LastBuildInfo}} options
 *
 * @returns {Promise<{[artifactPath: string]: {[artifactFilePath: string]: FileHash}}>}
 */
async function filesChangedSinceLastBuild({repositoryDirectory, lastBuildInfo}) {
  const commit = gitRepoInfo(repositoryDirectory).sha
  const currentRepoInfo = await findChangesInCurrentRepo(repositoryDirectory, commit)

  return await calculateFilesChangedSinceLastBuild(
    repositoryDirectory,
    lastBuildInfo,
    currentRepoInfo,
  )
}

/**
 *
 * @param {{lastBuildInfo: LastBuildInfo}} options
 *
 * @returns {{[name: string]: Date?}}
 */
function artifactBuildTimestamps({lastBuildInfo}) {
  return objectFromEntries(
    lastBuildInfo.map(({name, timestamp}) => [name, timestamp && new Date(timestamp)]),
  )
}

/**
 *
 * @param {{repositoryDirectory: string, artifactPath: string}} options
 *
 * @returns {Promise<void>}
 */
async function saveBuildInfo({
  repositoryDirectory,
  artifact: {name, path: artifactPath},
  isPrebuild,
}) {
  const biltJsonDir = path.join(repositoryDirectory, '.bilt', artifactPath)
  await makeDir(biltJsonDir)

  const commit = gitRepoInfo(repositoryDirectory).sha

  const filesChangedInWorkspace = new Set(
    (await listFilesChangedInWorkspace(repositoryDirectory, commit)).filter(f =>
      f.startsWith(artifactPath + '/'),
    ),
  )
  const workspaceFilesThatWereBuilt = await readHashesOfFiles(repositoryDirectory, [
    ...filesChangedInWorkspace,
  ])

  await p(fs.writeFile)(
    path.join(biltJsonDir, `bilt${isPrebuild ? '.prebuild' : ''}.json`),
    JSON.stringify({
      name,
      path: artifactPath,
      lastSuccessfulBuild: {
        commit,
        changedFilesInWorkspace: workspaceFilesThatWereBuilt,
      },
    }),
  )
}

/**
 *
 * @param {{repositoryDirectory: string, artifactPath: string, now?: Date}} options
 *
 * @returns {Promise<void>}
 */
async function copyPrebuildToLastBuildInfo({repositoryDirectory, artifactPath, now = new Date()}) {
  const biltJsonDir = path.join(repositoryDirectory, '.bilt', artifactPath)

  const prebuild = JSON.parse(await p(fs.readFile)(path.join(biltJsonDir, 'bilt.prebuild.json')))
  await p(fs.writeFile)(
    path.join(biltJsonDir, 'bilt.json'),
    JSON.stringify({
      lastSuccessfulBuild: {
        timestamp: now.toISOString(),
        commit: prebuild.lastSuccessfulBuild.commit,
        changedFilesInWorkspace: prebuild.lastSuccessfulBuild.changedFilesInWorkspace,
      },
    }),
  )
}

async function listBuildInfo({repositoryDirectory}) {
  try {
    return await listBuildInfoDo(path.join(repositoryDirectory, '.bilt'))
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []
    }
    throw err
  }

  async function listBuildInfoDo(dir) {
    const directoryEntries = await p(fs.readdir)(dir, {
      withFileTypes: true,
    })

    const biltJsonEntry = directoryEntries.find(
      directoryEntry => directoryEntry.isFile() && directoryEntry.name === 'bilt.json',
    )

    const subDirectories = directoryEntries.filter(directoryEntry => directoryEntry.isDirectory())

    const [biltJson, subDirBiltJsons] = await Promise.all([
      biltJsonEntry ? readBiltJson(dir) : undefined,
      subDirectories.length > 0
        ? Promise.all(
            subDirectories.map(subDirectory => listBuildInfoDo(path.join(dir, subDirectory.name))),
          )
        : Promise.resolve([]),
    ])

    return (biltJson ? [{name: biltJson.name, path: biltJson.path}] : []).concat(
      [].concat(...subDirBiltJsons),
    )
  }

  async function readBiltJson(dir) {
    return JSON.parse(await p(fs.readFile)(path.join(dir, 'bilt.json')))
  }
}

async function addBuildInfo({repositoryDirectory, artifact}) {
  const biltJsonDir = path.join(repositoryDirectory, '.bilt', artifact.path)

  const biltJson = path.join(biltJsonDir, 'bilt.json')

  if (await p(fs.exists)(biltJson)) { // eslint-disable-line
    // eslint-disable-line
    return true
  }

  await makeDir(biltJsonDir)
  await p(fs.writeFile)(biltJson, JSON.stringify({name: artifact.name, path: artifact.path}))

  return false
}

async function removeBuildInfo({repositoryDirectory, artifactPath}) {
  const biltJsonDir = path.join(repositoryDirectory, '.bilt', artifactPath)

  await p(rimraf)(biltJsonDir)
}

async function readBiltJson(artifactrepositoryDirectory) {
  // {commit, changedFilesInWorkspace}
  try {
    const biltJson = JSON.parse(
      await p(fs.readFile)(path.join(artifactrepositoryDirectory, 'bilt.json')),
    )

    return biltJson.lastSuccessfulBuild
  } catch (err) {
    if (err.code === 'ENOEXIST') {
      return undefined
    } else if (err.code === 'ENOENT') {
      return undefined
    } else if (err instanceof SyntaxError) {
      console.error('Could not parse .bilt/bilt.json. Building all.')
      return undefined
    }
    throw err
  }
}

async function findChangesInCurrentRepo(repositoryDirectory, commit) {
  return {
    commit,
    changedFilesInWorkspace: await readHashesOfFiles(
      repositoryDirectory,
      await listFilesChangedInWorkspace(repositoryDirectory, commit),
    ),
  }
}

async function listFilesChangedInWorkspace(repositoryDirectory, commit) {
  return (await filterBybiltIgnore(
    repositoryDirectory,
    commit ? await gitFindChangedFiles(repositoryDirectory) : [],
  )).map(f => path.relative(repositoryDirectory, f))
}

async function calculateFilesChangedSinceLastBuild(
  repositoryDirectory,
  lastBuildInfo,
  currentRepoInfo,
) {
  const filesChangedByArtifactPath = {}

  for (const artifactInfo of lastBuildInfo) {
    const {
      commit,
      changedFilesInWorkspace: changedFilesInLastBuildWorkspace,
      path: artifactPath,
    } = artifactInfo
    const artifactCurrentRepoChangedFilesInWorkspace = pickBy_(
      currentRepoInfo.changedFilesInWorkspace,
      (_hash, file) => file.startsWith(artifactPath + '/'),
    )

    if (commit === undefined) {
      filesChangedByArtifactPath[artifactPath] = undefined
    } else if (commit === currentRepoInfo.commit) {
      const filesChangedSinceLastSuccesfulBuild = determineChangedFiles(
        artifactCurrentRepoChangedFilesInWorkspace,
        changedFilesInLastBuildWorkspace,
      )
      filesChangedByArtifactPath[artifactPath] = filesChangedSinceLastSuccesfulBuild
    } else {
      const filesChangedBetweenCommits = (await filesChangedFromCommitToCommit(
        repositoryDirectory,
        commit,
        currentRepoInfo.commit,
      )).filter(file => file.startsWith(artifactPath + '/'))
      const filesChangedSinceLastSuccesfulBuild = {
        ...artifactCurrentRepoChangedFilesInWorkspace,
        ...(await readHashesOfFiles(repositoryDirectory, filesChangedBetweenCommits)),
      }
      const filesThatNeedToBeBuilt = {}

      for (const [fileChangedSinceLastSuccesfulBuild, hash] of Object.entries(
        filesChangedSinceLastSuccesfulBuild || {},
      )) {
        if (changedFilesInLastBuildWorkspace[fileChangedSinceLastSuccesfulBuild] !== hash) {
          filesThatNeedToBeBuilt[fileChangedSinceLastSuccesfulBuild] = hash
        }
      }
      filesChangedByArtifactPath[artifactPath] = filesThatNeedToBeBuilt
    }
  }

  return filesChangedByArtifactPath
}

async function readHashesOfFiles(repositoryDirectory, files) {
  const hashAndFiles = await Promise.all(
    files.map(async file => [file, await readHashOfFile(path.resolve(repositoryDirectory, file))]),
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
  if (lastBuildFiles === undefined) {
    return currentFiles
  }
  const filesChangedFromLastBuild = fromEntries(
    Object.entries(currentFiles).filter(
      ([file, hash]) => !lastBuildFiles[file] || lastBuildFiles[file] !== hash,
    ),
  )

  const filesDeletedFromLastBuild = fromEntries(
    Object.entries(lastBuildFiles).filter(([file]) => !currentFiles[file]),
  )

  return {...filesChangedFromLastBuild, ...filesDeletedFromLastBuild}
}

function fromEntries(entries) {
  return entries.reduce((acc, [key, value]) => ({...acc, [key]: value}), {})
}

async function filesChangedFromCommitToCommit(repositoryDirectory, fromCommit, toCommit) {
  return [
    ...new Set(
      (await p(childProcess.execFile)(
        'git',
        ['diff-tree', '--no-commit-id', '--name-only', '-r', fromCommit, toCommit],
        {
          cwd: repositoryDirectory,
        },
      )).stdout
        .split('\n')
        .filter(l => !!l),
    ),
  ]
}

async function filterBybiltIgnore(repositoryDirectory, files) {
  return (await Promise.all(
    files.map(async file => await filterFileBybiltIgnore(repositoryDirectory, file)),
  )).filter(f => !!f)
}

async function filterFileBybiltIgnore(repositoryDirectory, file) {
  const ignoreMask = await findbiltIgnorePattern(repositoryDirectory, file)

  return ignoreMask.ignores(file) ? undefined : file
}

async function findbiltIgnorePattern(repositoryDirectory, file) {
  const ignoreMask = ignore()
  ignoreMask.add('.bilt')
  for (const dir of directoriesBetween(repositoryDirectory, file)) {
    try {
      ignoreMask.add(
        await p(fs.readFile)(path.join(dir, '.biltignore'), {
          encoding: 'utf-8',
        }),
      )
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }

  return ignoreMask
}

function directoriesBetween(repositoryDirectory, file) {
  assert(file.startsWith(repositoryDirectory))

  const filerepositoryDirectory = path.dirname(file)

  const missingSegments = filerepositoryDirectory.slice(repositoryDirectory.length + 1).split('/')

  return missingSegments.reduce(
    (directories, segment) =>
      directories.concat(path.join(directories[directories.length - 1], segment)),
    [repositoryDirectory],
  )
}

function objectFromEntries(entries) {
  const ret = Object.create(null)

  for (const [key, value] of entries) {
    ret[key] = value
  }

  return ret
}

const gitFindChangedFiles = root =>
  getChangedFilesForRoots([root]).then(({changedFiles, repos}) => {
    const repoRoot = [...repos.git][0]

    return [...changedFiles].map(f => root + f.slice(repoRoot.length))
  })

module.exports = {
  lastBuildInfo,
  filesChangedSinceLastBuild,
  artifactBuildTimestamps,
  saveBuildInfo,
  copyPrebuildToLastBuildInfo,
  listBuildInfo,
  addBuildInfo,
  removeBuildInfo,
}
