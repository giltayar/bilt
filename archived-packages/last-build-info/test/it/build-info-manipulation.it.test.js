'use strict'
const path = require('path')
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {setupBuildDir} = require('../utils/setup')
const {listBuildInfo, saveBuildInfo, removeBuildInfo, addBuildInfo} = require('../..')

describe('buildInfo manipulation (it)', async function() {
  it('add and remove buildInfo', async () => {
    const repositoryDirectory = await setupBuildDir(
      path.join(__dirname, 'last-build-info/test-folder-deep'),
    )
    const artifacts = [
      {name: 'a', path: 'a'},
      {name: 'b', path: 'b'},
      {name: 'c1', path: 'c/c1'},
      {name: 'c2', path: 'c/c2'},
    ]

    expect(await listBuildInfo({repositoryDirectory})).to.have.length(0)

    await addBuildInfo({repositoryDirectory, artifact: {name: 'c1', path: 'c/c1'}})

    expect(await listBuildInfo({repositoryDirectory})).to.eql([{name: 'c1', path: 'c/c1'}])

    for (const artifact of artifacts) {
      await saveBuildInfo({repositoryDirectory, artifact, isPrebuild: false})
    }
    expect(await listBuildInfo({repositoryDirectory})).to.have.length(4)

    await removeBuildInfo({repositoryDirectory, artifactPath: 'a'})
    expect(await listBuildInfo({repositoryDirectory})).to.have.length(3)
    expect(await listBuildInfo({repositoryDirectory})).to.have.deep.members([
      {name: 'b', path: 'b'},
      {name: 'c1', path: 'c/c1'},
      {name: 'c2', path: 'c/c2'},
    ])

    await addBuildInfo({repositoryDirectory, artifact: artifacts[0]})
    expect(await listBuildInfo({repositoryDirectory})).to.have.deep.members([
      {name: 'a', path: 'a'},
      {name: 'b', path: 'b'},
      {name: 'c1', path: 'c/c1'},
      {name: 'c2', path: 'c/c2'},
    ])
  })
})
