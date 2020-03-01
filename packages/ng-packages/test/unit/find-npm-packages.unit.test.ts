import path from 'path'
import {describe, it} from 'mocha'
import {expect} from 'chai'

import {findNpmPackages} from '../../src/ng-packages'

describe('findNpmPackages (unit)', function() {
  it('should find npm packages', async () => {
    const rootDirectory = path.join(__dirname, 'test-repo')

    const packages = await findNpmPackages({rootDirectory})
    expect(packages).to.have.deep.members([{directory: 'a'}, {directory: 'adir/b'}])
  })
})
