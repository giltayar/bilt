import path from 'path'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import {fileURLToPath, URL} from 'url'

import {findNpmPackages} from '../../src/npm-packages.js'

/**
 * @typedef {import('@bilt/types').Directory} Directory
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url))

describe('findNpmPackages (unit)', function () {
  it('should find npm packages', async () => {
    const rootDirectory = /**@type {Directory}*/ (path.join(__dirname, 'test-repo'))

    const packages = await findNpmPackages({rootDirectory})
    expect(packages).to.have.deep.members([{directory: 'a'}, {directory: 'adir/b'}])
  })
})
