'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const {npmNextVersion} = require('../..')

describe('npmNextVersion (it)', function () {
  it('should work', async () => {
    expect(
      await npmNextVersion({
        name: '@bilt/package-that-is-for-testing-npm-next-version',
        version: '1.4.5',
      }),
    ).to.equal('1.4.7')
  })
})
