import {describe, it} from 'mocha'
import {expect} from 'chai'

import * as ng from '../../src/npm-packages'

describe('npm-packages (unit)', function () {
  it('should be able to add', async () => {
    expect(ng).to.not.be.undefined
  })
})
