'use strict'

module.exports = artifacts => {
  const availableArtifacts = new Set(artifacts.map(artifact => artifact.artifact))

  return artifacts.map(artifact =>
    Object.assign({}, artifact, {
      dependencies: (artifact.dependencies || []).filter(dep => availableArtifacts.has(dep)),
    }),
  )
}
