'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const compute = require('../../src/compute-directory-name')

describe('compute-directory-name', function() {
  it('should work correctly', async () => {
    expect(compute('git@github.com:giltayar/universal-studios.git')).to.equal(
      'git_github_com_giltayar_universal-studios_git',
    )

    expect(compute('https://github.com/giltayar/UNIVERSAL1-studios.git')).to.equal(
      'https_github_com_giltayar_UNIVERSAL1-studios_git',
    )
  })
})
