'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')
const fs = require('fs')
const path = require('path')
const {execFile} = require('child_process')
const {promisify: p} = require('util')
const {setupBuildDir} = require('../utils/setup')
const buildInfoMaker = require('../../src/last-build-info')

describe('last-build-info', () => {
  describe('filesChangedSinceLastBuild and savePackageLastBuildInfo', () => {
    it('should enable saving and re-reading on an initial folder', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        packageFilesChangedSinceLastBuild: [],
      })

      expect(await buildInfo.filesChangedSinceLastBuild({artifacts})).to.eql({
        a: undefined,
        b: undefined,
      })
    })
  })

  describe('repo changes', () => {
    it.only('should show no changes in files on an untouched workspace', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      expect(await buildInfo.filesChangedSinceLastBuild({artifacts})).to.eql({
        a: undefined,
        b: undefined,
      })
    })

    it.only('should not show file changes even if we change, if there was no previous save', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      expect(await buildInfo.filesChangedSinceLastBuild({artifacts})).to.eql({
        a: undefined,
        b: undefined,
      })
    })

    it.only('should show file changes if we change a file in one artifact, if there was a previous save for that artifact', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      const fcslb = await buildInfo.filesChangedSinceLastBuild({artifacts})
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: fcslb['a'],
      })

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      expect(await buildInfo.filesChangedSinceLastBuild({artifacts})).to.eql({
        a: ['a/a.txt'],
        b: undefined,
      })
    })

    it('should show file changes in an added file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})

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
    it('should show only changed files if on same commit', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})

      const lastBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

      await p(fs.writeFile)(path.join(gitDir, 'a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'c.txt'), 'lalala')

      const currentRepoInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

      const changes = await buildInfo.calculateFilesChangedSinceLastBuild(
        gitDir,
        lastBuildInfo,
        currentRepoInfo,
      )

      expect(changes).to.have.members(['a.txt', 'c.txt'])

      const changes2 = await buildInfo.calculateFilesChangedSinceLastBuild(
        gitDir,
        currentRepoInfo,
        currentRepoInfo,
      )

      expect(changes2).to.be.empty
    })

    it('should work even if has more than one commit', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})

      const firstBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

      await p(fs.writeFile)(path.join(gitDir, 'a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'c.txt'), 'lalala')

      await p(execFile)('git', ['add', '.'], {cwd: gitDir})
      await p(execFile)('git', ['commit', '-am', 'sadfsaf'], {cwd: gitDir})

      await p(fs.writeFile)(path.join(gitDir, 'd.txt'), 'zzz')
      await p(fs.writeFile)(path.join(gitDir, 'c.txt'), 'abc')

      const currentRepoInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

      const changes = await buildInfo.calculateFilesChangedSinceLastBuild(
        gitDir,
        firstBuildInfo,
        currentRepoInfo,
      )

      expect(changes).to.have.members(['a.txt', 'c.txt', 'd.txt'])
    })

    it('should rebuild a reverted file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})

      await p(fs.writeFile)(path.join(gitDir, 'a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'c.txt'), 'lalala2')

      const secondBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

      await p(execFile)('git', ['checkout', '--', 'a.txt'], {cwd: gitDir})

      const repoInfoAfterRevert = await buildInfo.findChangesInCurrentRepo(gitDir)
      const changesAfterRevert = await buildInfo.calculateFilesChangedSinceLastBuild(
        gitDir,
        secondBuildInfo,
        repoInfoAfterRevert,
      )
      expect(changesAfterRevert).to.have.members(['a.txt'])
    })

    it('should ignore a deleted file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})

      await p(fs.writeFile)(path.join(gitDir, 'a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'c.txt'), 'lalala2')

      const secondBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

      await p(fs.unlink)(path.join(gitDir, 'a.txt'))

      const repoInfoAfterRevert = await buildInfo.findChangesInCurrentRepo(gitDir)
      const changesAfterRevert = await buildInfo.calculateFilesChangedSinceLastBuild(
        gitDir,
        secondBuildInfo,
        repoInfoAfterRevert,
      )
      expect(changesAfterRevert).to.have.members(['a.txt'])
    })

    describe('.biltignore', () => {
      it('should work in root', async () => {
        const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
        const buildInfo = await buildInfoMaker({config: {directory: gitDir}})

        const firstBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

        await p(fs.writeFile)(path.join(gitDir, 'ignore.txt'), 'lalala')

        const secondBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

        const changesAfterSecond = await buildInfo.calculateFilesChangedSinceLastBuild(
          gitDir,
          firstBuildInfo,
          secondBuildInfo,
        )
        expect(changesAfterSecond).to.be.empty
      })

      it('should override in subfolder', async () => {
        const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
        const buildInfo = await buildInfoMaker({config: {directory: gitDir}})

        const firstBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/ignore.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/a.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'a.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/dontignore.txt'), 'lalala')

        const secondBuildInfo = await buildInfo.findChangesInCurrentRepo(gitDir)

        const changesAfterSecond = await buildInfo.calculateFilesChangedSinceLastBuild(
          gitDir,
          firstBuildInfo,
          secondBuildInfo,
        )
        expect(changesAfterSecond).to.have.members([
          'a.txt',
          'ignoramus/dontignore.txt',
          'ignoramus/ignore.txt',
        ])
      })
    })
  })
})
