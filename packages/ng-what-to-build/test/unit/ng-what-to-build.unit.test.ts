import {describe, it} from 'mocha'
import {expect} from 'chai'

import * as ng from '../../src/ng-what-to-build'

describe('ng-what-to-build (unit)', function() {
  it('should be able to add', async () => {
    expect(ng).to.not.be.undefined
  })
})
