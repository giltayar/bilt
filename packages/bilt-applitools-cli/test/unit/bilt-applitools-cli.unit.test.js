'use strict'
const {describe = globalThis.describe, it = globalThis.it} = require('mocha')
const {expect} = require('chai')

const m = require('../..')

describe('bilt-applitools-cli (unit)', function () {
  it('should be able to load (you can delete this test once you have others)', async () => {
    expect(m).to.not.be.undefined
  })
})
