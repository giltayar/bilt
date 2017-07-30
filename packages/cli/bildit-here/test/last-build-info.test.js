const {describe, beforeEach} = require('mocha')
const {expect} = require('chai')
const path = require('path')
const replayGitRepo = require('./replay-git-repo')
const lastBuildInfo = require('../src/last-build-info')

describe('readLastBuildInfo', () => {
  let gitDir

  beforeEach(async () => (gitDir = await replayGitRepo(path.join(__dirname, 'test-folder'))))

  it('should return undefined when no .bildit folder', async () => {
    expect(await lastBuildInfo.readLastBuildInfo(gitDir)).to.be.undefined
  })
})
