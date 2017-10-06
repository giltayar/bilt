'use strict'

const createDependencyGraph = artifacts =>
  objectFromEntries(artifacts.map(({artifact, dependencies}) => [artifact, dependencies || []]))

function artifactsToBuildFromChange(dependencyGraph, changedArtifacts) {
  const closure = new Set(changedArtifacts)

  let addToBuildsInClosure = true
  while (addToBuildsInClosure) {
    const lengthOfClosure = closure.size

    Object.entries(dependencyGraph)
      .filter(([, dependencies]) => !!dependencies.find(dependent => closure.has(dependent)))
      .map(([build]) => build)
      .forEach(build => closure.add(build))

    addToBuildsInClosure = lengthOfClosure < closure.size
  }

  const ret = {}
  closure.forEach(build => (ret[build] = intersection(dependencyGraph[build], closure)))

  return ret
}

const buildsThatCanBeBuilt = (dependencyGraph, alreadyBuiltArtifacts) => {
  const alreadyBuiltArtifactsSet = new Set(alreadyBuiltArtifacts)

  return difference(
    Object.entries(dependencyGraph)
      .filter(([, dependencies]) =>
        dependencies.every(dependentBuild => alreadyBuiltArtifactsSet.has(dependentBuild)),
      )
      .map(([build]) => build),
    alreadyBuiltArtifacts,
  )
}

const difference = (arr, brr) => arr.filter(aMember => !brr.includes(aMember))
const intersection = (arr, bset) => arr.filter(aMember => bset.has(aMember))

function objectFromEntries(entries) {
  const ret = Object.create(null)

  for (const [key, value] of entries) {
    ret[key] = value
  }

  return ret
}

module.exports = {
  createDependencyGraph,
  artifactsToBuildFromChange,
  buildsThatCanBeBuilt,
}
