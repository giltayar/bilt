'use strict'
const {describe = global.describe, it = global.it} = require('mocha')
const {expect} = require('chai')

const m = require('../../src/git-testkit')

describe('git-testkit (unit)', function () {
  it('should be able to load (you can delete this test once you have others)', async () => {
    expect(m).to.not.be.undefined
  })
})
