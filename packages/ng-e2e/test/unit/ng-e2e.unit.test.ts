import {describe, it} from 'mocha'
import {expect} from 'chai'

import {add} from '../../src/ng-e2e'

describe('ng-e2e (unit)', function() {
  it('should be able to add', async () => {
    expect(add({a: 2, b: 5})).to.equal(7)
  })
})
