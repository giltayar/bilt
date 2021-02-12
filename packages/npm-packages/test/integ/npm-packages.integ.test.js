import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'

import * as ng from '../../src/npm-packages.js'

describe('npm-packages (unit)', function () {
  it('should be able to add', async () => {
    expect(ng).to.not.be.undefined
  })
})
