'use strict'
const path = require('path')
const {
  lastBuildInfo,
  removeArtifactBuildInfo,
  addArtifactBuildInfo,
} = require('@bilt/last-build-info')
const artifactFinder = require('@bilt/artifact-finder')

async function listDevelopmentList(buildDirectory) {
  console.log((await listOfDevelopmentArtifacts(buildDirectory)).join('\n'))
}

async function addToDevelopmentList(buildDirectory, artifactsToAdd) {
  const [missingArtifacts, artifacts] = await findMissingArtifacts(artifactsToAdd, buildDirectory)

  if (missingArtifacts.length > 0) {
    return console.error('Could not find artifacts', missingArtifacts.join(', '))
  }

  await Promise.all(
    artifactsToAdd.map(pkg =>
      addArtifactBuildInfo({
        repositoryDirectory: buildDirectory,
        artifact: artifacts.find(p => p.path === pkg),
      }),
    ),
  )
}

async function removeFromDevelopmentList(buildDirectory, artifactsToRemove) {
  const [missingArtifacts] = await findMissingArtifacts(artifactsToRemove, buildDirectory)

  if (missingArtifacts.length > 0) {
    return console.error('Could not find artifacts', missingArtifacts.join(', '))
  }

  await Promise.all(
    artifactsToRemove.map(pkg =>
      removeArtifactBuildInfo({
        repositoryDirectory: buildDirectory,
        artifactPath: pkg,
      }),
    ),
  )
}

async function resetDevelopmentList(buildDirectory) {
  const artifacts = await listOfDevelopmentArtifacts(buildDirectory)

  await Promise.all(
    artifacts.map(pkg =>
      removeArtifactBuildInfo({
        repositoryDirectory: buildDirectory,
        artifact: pkg,
      }),
    ),
  )
}

async function listOfDevelopmentArtifacts(buildDirectory) {
  const artifacts = await (await artifactFinder()).findArtifacts(buildDirectory)
  const buildInfo = await lastBuildInfo({
    repositoryDirectory: buildDirectory,
    artifacts,
  })

  return buildInfo
}

async function findMissingArtifacts(artifactsToAdd, buildDirectory) {
  const fullArtifactsToAdd = artifactsToAdd.map(path => path.resolve(buildDirectory, path))
  const artifacts = (await listOfDevelopmentArtifacts(buildDirectory)).map(path =>
    path.resolve(buildDirectory, path),
  )

  const missingArtifacts = artifacts.filter(
    p => !fullArtifactsToAdd.find(pToRemove => p === pToRemove),
  )

  return [missingArtifacts.map(p => path.relative(buildDirectory, p)), artifacts]
}

module.exports = {
  listDevelopmentList,
  addToDevelopmentList,
  removeFromDevelopmentList,
  resetDevelopmentList,
}
