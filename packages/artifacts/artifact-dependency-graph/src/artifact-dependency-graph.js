'use strict'

const createDependencyGraph = artifacts =>
  objectFromEntries(artifacts.map(({name, dependencies}) => [name, dependencies || []]))

function dependencyGraphSubsetToBuild({
  dependencyGraph,
  changedArtifacts,
  artifactBuildTimestamps = {},
  fromArtifacts,
  uptoArtifacts,
  justBuildArtifacts,
}) {
  const dependencyGraphSubset = {}

  const changedArtifactsDueToDependencyChanges = artifactsChangedDuetoDependencies(
    dependencyGraph,
    changedArtifacts || [],
    artifactBuildTimestamps,
  )

  const allChangedArtifacts =
    !changedArtifactsDueToDependencyChanges && !changedArtifacts
      ? undefined
      : [...new Set((changedArtifacts || []).concat(changedArtifactsDueToDependencyChanges || []))]

  // upto
  if (uptoArtifacts) {
    const uptoClosure = new Set(uptoArtifacts)

    addArtifactsNeededToBeBuiltForArtifactsInClosure(uptoClosure, dependencyGraph)

    if (allChangedArtifacts) {
      const fromClosure = new Set(allChangedArtifacts)

      addArtifactsAffectedByBuildingArtifactsInClosure(fromClosure, dependencyGraph)

      uptoClosure.forEach(artifact => {
        if (!fromClosure.has(artifact)) {
          uptoClosure.delete(artifact)
        }
      })
    }

    uptoClosure.forEach(build => (dependencyGraphSubset[build] = dependencyGraph[build]))
  }

  // from
  if (fromArtifacts) {
    const fromClosure = new Set(fromArtifacts.concat(Object.keys(dependencyGraphSubset)))

    addArtifactsAffectedByBuildingArtifactsInClosure(fromClosure, dependencyGraph)

    if (allChangedArtifacts) {
      const moreFromClosure = new Set(allChangedArtifacts)

      addArtifactsAffectedByBuildingArtifactsInClosure(moreFromClosure, dependencyGraph)

      fromClosure.forEach(artifact => {
        if (!moreFromClosure.has(artifact)) {
          fromClosure.delete(artifact)
        }
      })
    }
    fromClosure.forEach(build => (dependencyGraphSubset[build] = dependencyGraph[build]))
  }

  // justBuild
  if (justBuildArtifacts) {
    const justBuildChangedArtifacts = allChangedArtifacts
      ? intersection(justBuildArtifacts, allChangedArtifacts)
      : justBuildArtifacts

    justBuildChangedArtifacts.forEach(
      build => (dependencyGraphSubset[build] = dependencyGraph[build]),
    )
  }

  // filter dependencies
  filterOutArtifactsFromDependencies(dependencyGraphSubset)

  if (allChangedArtifacts) {
    removeLeafArtifactsThatDoNotNeedToBeBuilt(dependencyGraphSubset, allChangedArtifacts)
  }

  // filter dependencies again (because leaf nodes were removed from dependency graph)
  filterOutArtifactsFromDependencies(dependencyGraphSubset)

  return dependencyGraphSubset
}

function filterOutArtifactsFromDependencies(ret) {
  const artifactsToBuild = Object.keys(ret)

  Object.entries(ret).forEach(
    ([artifact, dependencies]) =>
      (ret[artifact] = intersection(dependencies || [], artifactsToBuild)),
  )
}

function removeLeafArtifactsThatDoNotNeedToBeBuilt(dependencyGraph, changedArtifacts) {
  return objectFromEntries(
    Object.entries(dependencyGraph).filter(
      ([artifact, dependencies]) => dependencies.length > 0 || changedArtifacts.includes(artifact),
    ),
  )
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
const intersection = (arr, bset) => arr.filter(aMember => bset.includes(aMember))

function addArtifactsAffectedByBuildingArtifactsInClosure(closure, dependencyGraph) {
  let addToBuildsInClosure = true

  while (addToBuildsInClosure) {
    const lengthOfClosure = closure.size

    artifactsAffectedByBuildingArtifactsInClosure(closure, dependencyGraph).forEach(build =>
      closure.add(build),
    )

    addToBuildsInClosure = lengthOfClosure < closure.size
  }
}

function artifactsAffectedByBuildingArtifactsInClosure(closure, dependencyGraph) {
  return Object.entries(dependencyGraph)
    .filter(([, dependencies]) => !!dependencies.find(dependent => closure.has(dependent)))
    .map(([build]) => build)
}

function addArtifactsNeededToBeBuiltForArtifactsInClosure(closure, dependencyGraph) {
  let addToBuildsInClosure = true

  while (addToBuildsInClosure) {
    const lengthOfClosure = closure.size

    artifactsNeededToBeDirectlyBuiltForArtifactsInClosure(closure, dependencyGraph).forEach(build =>
      closure.add(build),
    )

    addToBuildsInClosure = lengthOfClosure < closure.size
  }
}

const flatten = arr => [].concat(...arr)

function artifactsNeededToBeDirectlyBuiltForArtifactsInClosure(closure, dependencyGraph) {
  return flatten([...closure].map(artifact => dependencyGraph[artifact]))
}

function objectFromEntries(entries) {
  const ret = Object.create(null)

  for (const [key, value] of entries) {
    ret[key] = value
  }

  return ret
}

function artifactsChangedDuetoDependencies(
  dependencyGraph,
  changedArtifacts,
  artifactBuildTimestamps,
) {
  const changedArtifactsDueToDependencies = []
  const now = new Date()

  for (const [artifact, dependencies] of Object.entries(dependencyGraph)) {
    const artifactChangeTime = (artifactBuildTimestamps[artifact] || now).getTime()
    const artifactChangedDueToDepencies = dependencies.some(
      dep => (artifactBuildTimestamps[dep] || now).getTime() > artifactChangeTime,
    )

    if (artifactChangedDueToDepencies) {
      changedArtifactsDueToDependencies.push(artifact)
    }
  }

  return changedArtifactsDueToDependencies.length === 0
    ? undefined
    : changedArtifactsDueToDependencies
}

module.exports = {
  createDependencyGraph,
  dependencyGraphSubsetToBuild,
  buildsThatCanBeBuilt,
}
