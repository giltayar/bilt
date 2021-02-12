import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import {resolve} from 'path'
import {fileURLToPath, URL} from 'url'
import thisModule from '../src/artifact-finder.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

describe('e2e test on a real folder', function () {
  it('should generate a file with the correct artifacts', async function () {
    const {findArtifacts} = await thisModule()
    const newYml = await findArtifacts(resolve(__dirname, 'e2e-test-dir'), '.zitignore')

    expect(newYml).to.have.deep.members([
      {
        name: 'npm-artifact-name-2',
        path: 'npm-artifact-2',
        type: 'npm',
        dependencies: [],
        owners: [],
      },
      {
        name: 'npm-artifact-3',
        path: 'npm-artifact-3',
        type: 'npm',
        dependencies: [],
        owners: [],
      },
      {
        name: 'npm-artifact-name',
        path: 'main/npm-artifact',
        type: 'npm',
        dependencies: ['npm-artifact-name-2'],
        owners: [],
      },
    ])
  })
})
