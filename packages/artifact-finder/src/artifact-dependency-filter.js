/**
 * @param {any[]} artifacts
 */
export default (artifacts) => {
  const availableArtifacts = new Set(artifacts.map((artifact) => artifact.name))

  return artifacts.map((artifact) =>
    Object.assign({}, artifact, {
      dependencies: (artifact.dependencies || []).filter(
        /**
         * @param {any} dep
         */ (dep) => availableArtifacts.has(dep),
      ),
    }),
  )
}
