import path from 'path'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import {fileURLToPath, URL} from 'url'

import {findNpmPackageInfos} from '../../src/npm-packages.js'

/**
 * @typedef {import('@bilt/types').Directory} Directory
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url))

describe('findNpmPackageInfos (unit)', function () {
  it('should find npm package infos', async () => {
    const rootDirectory = /**@type {Directory}*/ (path.join(__dirname, 'test-repo'))

    const packages = [
      {directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ ('a')},
      {directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ ('adir/b')},
    ]
    const packageInfos = await findNpmPackageInfos({rootDirectory, packages})

    expect(packageInfos).to.eql({
      a: {directory: 'a', name: '@lalala/a-package', dependencies: []},
      'adir/b': {directory: 'adir/b', name: '@lalala/b-package', dependencies: [{directory: 'a'}]},
    })
  })

  it('should ignore dependencies that are not semver compatible', async () => {
    const rootDirectory = /**@type {Directory}*/ (path.join(__dirname, 'test-repo-semver'))

    const packages = [
      {directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ ('a')},
      {directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ ('b')},
      {directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ ('c')},
    ]
    const packageInfos = await findNpmPackageInfos({rootDirectory, packages})

    expect(packageInfos).to.eql({
      a: {directory: 'a', name: 'a-package', dependencies: []},
      b: {directory: 'b', name: 'b-package', dependencies: [{directory: 'c'}]},
      c: {directory: 'c', name: 'c-package', dependencies: [{directory: 'b'}]},
    })
  })
})
