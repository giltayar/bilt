const {describe, beforeEach} = require('mocha')
const {expect} = require('chai')
const fs = require('fs')
const path = require('path')
const {promisify: p} = require('util')
const replayGitRepo = require('./replay-git-repo')
const buildInfo = require('../src/last-build-info')

describe('last-build-info', () => {
  let gitDir

  beforeEach(async () => (gitDir = await replayGitRepo(path.join(__dirname, 'test-folder'))))

  describe('readLastBuildInfo and saveLastBuildInfo', () => {
    it('should return undefined when no .bildit folder', async () => {
      expect(await buildInfo.readLastBuildInfo(gitDir)).to.be.undefined
    })

    it('should enable saving and re-reading', async () => {
      await buildInfo.saveLastBuildInfo(gitDir, {something: 4})

      expect(await buildInfo.readLastBuildInfo(gitDir)).to.deep.equal({something: 4})
    })
  })

  describe('findChangesInCurrentRepo', () => {
    it('should show no changes in files on an untouched workspace', async () => {
      const changes = await buildInfo.findChangesInCurrentRepo(gitDir)

      expect(changes.commit).to.be.ok
      expect(changes.changedFilesInWorkspace).to.be.empty
    })

    it('should show file changes in one file that we touch', async () => {
      await p(fs.writeFile)(path.join(gitDir, 'a.txt'), 'lalala')

      const changes = await buildInfo.findChangesInCurrentRepo(gitDir)

      expect(changes.commit).to.be.ok
      expect(changes.changedFilesInWorkspace).to.deep.equal({
        'a.txt': '9aa6e5f2256c17d2d430b100032b997c',
      })
    })

    it('should show file changes in an added file', async () => {
      await p(fs.writeFile)(path.join(gitDir, 'a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'c.txt'), 'lalala')

      const changes = await buildInfo.findChangesInCurrentRepo(gitDir)

      expect(changes.commit).to.be.ok
      expect(changes.changedFilesInWorkspace).to.deep.equal({
        'a.txt': '9aa6e5f2256c17d2d430b100032b997c',
        'c.txt': '9aa6e5f2256c17d2d430b100032b997c',
      })
    })
  })

  describe('calculateChangesToBuildSinceLastBuild', () => {
    it.only('should show only changed files if on same commit', async () => {
      const lastBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

      await p(fs.writeFile)(path.join(gitDir, 'a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'c.txt'), 'lalala')

      const currentRepoInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

      const changedFiles = buildInfo.calculateChangesToBuildSinceLastBuild(
        gitDir,
        lastBuildInfo,
        currentRepoInfo,
      )

      expect(changedFiles).to.have.members(['a.txt', 'c.txt'])
    })
  })
})
