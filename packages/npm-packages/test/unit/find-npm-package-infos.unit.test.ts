import path from 'path'
import {describe, it} from 'mocha'
import {expect} from 'chai'

import {findNpmPackages, findNpmPackageInfos} from '../../src/npm-packages'

describe('findNpmPackageInfos (unit)', function () {
  it('should find npm package infos', async () => {
    const rootDirectory = path.join(__dirname, 'test-repo')

    const packages = await findNpmPackages({rootDirectory})
    const packageInfos = await findNpmPackageInfos({rootDirectory, packages})

    expect(packageInfos).to.eql({
      a: {directory: 'a', name: '@lalala/a-package', dependencies: []},
      'adir/b': {directory: 'adir/b', name: '@lalala/b-package', dependencies: [{directory: 'a'}]},
    })
  })
})
