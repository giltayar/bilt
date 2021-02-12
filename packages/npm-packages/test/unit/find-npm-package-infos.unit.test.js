import path from 'path'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import {fileURLToPath, URL} from 'url'

import {findNpmPackages, findNpmPackageInfos} from '../../src/npm-packages.js'

/**
 * @typedef {import('@bilt/types').Directory} Directory
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url))

describe('findNpmPackageInfos (unit)', function () {
  it('should find npm package infos', async () => {
    const rootDirectory = /**@type {Directory}*/ (path.join(__dirname, 'test-repo'))

    const packages = await findNpmPackages({rootDirectory})
    const packageInfos = await findNpmPackageInfos({rootDirectory, packages})

    expect(packageInfos).to.eql({
      a: {directory: 'a', name: '@lalala/a-package', dependencies: []},
      'adir/b': {directory: 'adir/b', name: '@lalala/b-package', dependencies: [{directory: 'a'}]},
    })
  })
})
