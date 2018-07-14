'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const assert = require('assert')
const childProcess = require('child_process')
const {promisify: p} = require('util')
const makeDir = require('make-dir')
const pickBy_ = require('lodash.pickby')
const gitRepoInfo = require('git-repo-info')
const ignore = require('ignore')
const {getChangedFilesForRoots} = require('jest-changed-files')

const gitFindChangedFiles = root =>
  getChangedFilesForRoots([root]).then(({changedFiles, repos}) => {
    const repoRoot = [...repos.git][0]

    return [...changedFiles].map(f => root + f.slice(repoRoot.length))
  })

module.exports = async ({directory}) => {
  return {
    async lastBuildInfo({artifacts}) {
      return await Promise.all(
        artifacts.map(async artifact => {
          const biltJson = await readBiltJson(path.join(directory, '.bilt', artifact.path))

          return {
            name: artifact.name,
            path: artifact.path,
            ...biltJson,
          }
        }),
      )
    },
    // returns {[artifactPath]: {artifactFile: hash, ...}
    async filesChangedSinceLastBuild({lastBuildInfo}) {
      const commit = gitRepoInfo(directory).sha
      const currentRepoInfo = await findChangesInCurrentRepo(directory, commit)

      return await calculateFilesChangedSinceLastBuild(directory, lastBuildInfo, currentRepoInfo)
    },

    artifactBuildTimestamps({lastBuildInfo}) {
      return objectFromEntries(
        lastBuildInfo.map(({name, timestamp}) => [name, timestamp && new Date(timestamp)]),
      )
    },

    async savePackageLastBuildInfo({
      artifactPath,
      artifactFilesChangedSinceLastBuild,
      now = new Date(),
    }) {
      const commit = gitRepoInfo(directory).sha
      const biltJsonDir = path.join(directory, '.bilt', artifactPath)
      await makeDir(biltJsonDir)

      const filesChangedInWorkspace = new Set(
        (await listFilesChangedInWorkspace(directory, commit)).filter(f =>
          f.startsWith(artifactPath + '/'),
        ),
      )
      const workspaceFilesThatWereBuilt = artifactFilesChangedSinceLastBuild
        ? pickBy_(artifactFilesChangedSinceLastBuild, (_hash, f) => filesChangedInWorkspace.has(f))
        : await readHashesOfFiles(directory, [...filesChangedInWorkspace])

      await p(fs.writeFile)(
        path.join(biltJsonDir, 'bilt.json'),
        JSON.stringify({
          lastSuccessfulBuild: {
            timestamp: now.toISOString(),
            commit,
            changedFilesInWorkspace: workspaceFilesThatWereBuilt,
          },
        }),
      )
    },
  }
}

async function readBiltJson(artifactDirectory) {
  // {commit, changedFilesInWorkspace}
  try {
    const biltJson = JSON.parse(await p(fs.readFile)(path.join(artifactDirectory, 'bilt.json')))

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

async function findChangesInCurrentRepo(directory, commit) {
  return {
    commit,
    changedFilesInWorkspace: await readHashesOfFiles(
      directory,
      await listFilesChangedInWorkspace(directory, commit),
    ),
  }
}

async function listFilesChangedInWorkspace(directory, commit) {
  return (await filterBybiltIgnore(
    directory,
    commit ? await gitFindChangedFiles(directory) : [],
  )).map(f => path.relative(directory, f))
}

async function calculateFilesChangedSinceLastBuild(directory, lastBuildInfo, currentRepoInfo) {
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
        directory,
        commit,
        currentRepoInfo.commit,
      )).filter(file => file.startsWith(artifactPath + '/'))
      const filesChangedSinceLastSuccesfulBuild = {
        ...artifactCurrentRepoChangedFilesInWorkspace,
        ...(await readHashesOfFiles(directory, filesChangedBetweenCommits)),
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

async function readHashesOfFiles(directory, files) {
  const hashAndFiles = await Promise.all(
    files.map(async file => [file, await readHashOfFile(path.resolve(directory, file))]),
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

async function filesChangedFromCommitToCommit(directory, fromCommit, toCommit) {
  return [
    ...new Set(
      (await p(childProcess.execFile)(
        'git',
        ['diff-tree', '--no-commit-id', '--name-only', '-r', fromCommit, toCommit],
        {
          cwd: directory,
        },
      )).stdout
        .split('\n')
        .filter(l => !!l),
    ),
  ]
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
  ignoreMask.add('.bilt')
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

function objectFromEntries(entries) {
  const ret = Object.create(null)

  for (const [key, value] of entries) {
    ret[key] = value
  }

  return ret
}
