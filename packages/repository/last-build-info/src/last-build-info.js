'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const assert = require('assert')
const childProcess = require('child_process')
const {promisify: p} = require('util')
const makeDir = require('make-dir')
const gitRepoInfo = require('git-repo-info')
const ignore = require('ignore')
const {git: {findChangedFiles: gitFindChangedFiles}} = require('jest-changed-files')

module.exports = async ({config: {directory}}) => {
  return {
    // returns {[artifactPath]: [filesChangedSinceLastBuild]}
    async filesChangedSinceLastBuild({artifacts}) {
      const lastBuildInfo = await Promise.all(
        artifacts.map(async artifact => {
          const biltJson = await readBiltJson(path.join(directory, '.bilt', artifact.path))

          return {path: artifact.path, ...biltJson}
        }),
      )
      const commit = gitRepoInfo(directory).sha
      const currentRepoInfo = await findChangesInCurrentRepo(directory, commit)

      return await calculateFilesChangedSinceLastBuild(directory, lastBuildInfo, currentRepoInfo)
    },

    async savePackageLastBuildInfo({artifactPath, artifactFilesChangedSinceLastBuild}) {
      const commit = gitRepoInfo(directory).sha
      const biltJsonDir = path.join(directory, '.bilt', artifactPath)
      await makeDir(biltJsonDir)

      await p(fs.writeFile)(
        path.join(biltJsonDir, 'bilt.json'),
        JSON.stringify({
          lastSuccessfulBuild: {
            commit,
            changedFilesInWorkspace: artifactFilesChangedSinceLastBuild,
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
      (await filterBybiltIgnore(directory, commit ? await gitFindChangedFiles(directory) : [])).map(
        f => path.relative(directory, f),
      ),
    ),
  }
}

async function calculateFilesChangedSinceLastBuild(directory, lastBuildInfo, currentRepoInfo) {
  const filesChangedByArtifactPath = {}

  for (const artifactInfo of lastBuildInfo) {
    const {commit, changedFilesInWorkspace, path: artifactPath} = artifactInfo

    if (commit === undefined) {
      filesChangedByArtifactPath[artifactPath] = undefined
    } else if (commit === currentRepoInfo.commit) {
      const filesChangedSinceLastSuccesfulBuild = determineChangedFiles(
        currentRepoInfo.changedFilesInWorkspace,
        changedFilesInWorkspace,
      )
      filesChangedByArtifactPath[artifactPath] = filesChangedSinceLastSuccesfulBuild
    } else {
      const filesChangedSinceLastSuccesfulBuild = await filesChangedFromCommitToCommit(
        directory,
        commit,
        currentRepoInfo.commit,
      )
      const filesChanged = await readHashesOfFiles(directory, filesChangedSinceLastSuccesfulBuild)

      for (const {file, hash} of changedFilesInWorkspace || []) {
        if (await changedInCurrentDirectory(file, hash, currentRepoInfo.changedFilesInWorkspace)) {
          filesChanged[file] = hash
        }
      }

      for (const [file, hash] of Object.entries(currentRepoInfo.changedFilesInWorkspace)) {
        if (await changedInCurrentDirectory(file, hash, changedFilesInWorkspace || {})) {
          filesChanged[file] = hash
        }
      }

      filesChangedByArtifactPath[artifactPath] = filesChanged
    }
  }

  return filesChangedByArtifactPath

  async function changedInCurrentDirectory(file, hash, currentChangedFilesInWorkspace) {
    if (currentChangedFilesInWorkspace[file] !== undefined) {
      return currentChangedFilesInWorkspace[file] === hash
    } else {
      const fileHash = await readHashOfFile(path.resolve(directory, file))

      return fileHash === hash
    }
  }
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
