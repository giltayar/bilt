'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')
const path = require('path')
const thisModule = require('..')

describe('e2e test on a real folder', function() {
  it('should generate a file with the correct artifacts', async function() {
    const {findArtifacts} = await thisModule()
    const newYml = await findArtifacts(path.resolve(__dirname, 'e2e-test-dir'), '.zitignore')

    expect(newYml).to.deep.equal([
      {
        artifact: 'docker-artifactrc-alt',
        path: 'docker-artifactrc-artifact',
        type: 'docker-npm',
        dependencies: ['docker-artifact'],
        owners: [],
      },
      {
        artifact: 'docker-npm-artifact-name',
        path: 'docker-npm-artifact',
        type: 'docker-npm',
        dependencies: ['npm-artifact-name'],
        owners: [],
      },
      {
        artifact: 'docker-artifact',
        path: 'main/docker-artifact',
        type: 'docker-npm',
        dependencies: [],
        owners: [],
      },
      {
        artifact: 'npm-artifact-name',
        path: 'main/npm-artifact',
        type: 'npm',
        dependencies: ['docker-artifact'],
        owners: [],
      },
    ])
  })
})
