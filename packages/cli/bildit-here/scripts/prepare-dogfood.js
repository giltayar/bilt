const path = require('path')
const artifactFinderFactory = require('../../../artifacts/artifact-finder')
const {createSymlink} = require('../../../fs/symlink')
;(async () => {
  const artifactFinder = await artifactFinderFactory()

  const repoDirectory = path.resolve(__dirname, '../../../..')
  console.log('finding artifacts in', repoDirectory)
  const artifacts = (await artifactFinder.findArtifacts(repoDirectory)).filter(a =>
    a.path.startsWith('packages/'),
  )

  await Promise.all(
    artifacts.map(async artifact => {
      await createSymlink(
        path.join(repoDirectory, 'node_modules', artifact.artifact),
        path.resolve(repoDirectory, artifact.path),
      )
    }),
  )
})().catch(err => console.error(err.stack))
