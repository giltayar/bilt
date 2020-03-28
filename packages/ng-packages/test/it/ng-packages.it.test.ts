import {describe, it} from 'mocha'
import {expect} from 'chai'

import * as ng from '../../src/ng-packages'

describe('ng-packages (unit)', function () {
  it('should be able to add', async () => {
    expect(ng).to.not.be.undefined
  })
})
