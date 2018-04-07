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
  describe.only('repo changes', () => {
    it('should enable saving and re-reading on an initial folder', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        packageFilesChangedSinceLastBuild: undefined,
      })

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(Object.keys(changes)).to.have.members(['a', 'b'])
      expect(changes.b).to.be.undefined
      expect(Object.keys(changes.a)).to.have.members([])
    })

    it('should show no changes in files on an untouched workspace', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(changes).to.eql({
        a: undefined,
        b: undefined,
      })
    })

    it('should not show file changes even if we change, if there was no previous save', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      expect(await buildInfo.filesChangedSinceLastBuild({artifacts})).to.eql({
        a: undefined,
        b: undefined,
      })
    })

    it('should show file changes if we change a file in one artifact, if there was a previous save for that artifact', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      const fcslb = await buildInfo.filesChangedSinceLastBuild({artifacts})
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: fcslb['a'],
      })

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(Object.keys(changes)).to.have.members(['a', 'b'])
      expect(changes.b).to.be.undefined
      expect(Object.keys(changes.a)).to.have.members(['a/a.txt'])
    })

    it('should show file changes in an added file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      const fcslb = await buildInfo.filesChangedSinceLastBuild({artifacts})
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: fcslb['a'],
      })

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(Object.keys(changes)).to.have.members(['a', 'b'])
      expect(changes.b).to.be.undefined
      expect(Object.keys(changes.a)).to.have.members(['a/c.txt', 'a/a.txt'])
    })

    it('should show only changed files if on same commit', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      const fcslb = await buildInfo.filesChangedSinceLastBuild({artifacts})
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: fcslb['a'],
      })

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: changes['a'],
      })
      const changes2 = await buildInfo.filesChangedSinceLastBuild({artifacts})

      expect(Object.keys(changes2['a'])).to.eql([])
    })

    it('should work even if has more than one commit', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      const fcslb = await buildInfo.filesChangedSinceLastBuild({artifacts})
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: fcslb['a'],
      })

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      await p(execFile)('git', ['add', '.'], {cwd: gitDir})
      await p(execFile)('git', ['commit', '-m', 'sadfsaf'], {cwd: gitDir})

      await p(fs.writeFile)(path.join(gitDir, 'a/d.txt'), 'zzz')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'abc')

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(Object.keys(changes['a'])).to.have.members(['a/a.txt', 'a/c.txt', 'a/d.txt'])

      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: changes['a'],
      })

      const changes2 = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(Object.keys(changes2['a'])).to.eql([])
    })

    it('should rebuild a reverted file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(changes['a']).to.be.undefined
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: changes['a'],
      })

      await p(execFile)('git', ['checkout', '--', 'a/a.txt'], {cwd: gitDir})

      const changesAfterRevert = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(Object.keys(changesAfterRevert['a'])).to.eql(['a/a.txt'])
    })

    it('should deal with no changes after a first build', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala2')

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: changes['a'],
      })

      const changesAfterBuild = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(Object.keys(changesAfterBuild['a'])).to.eql([])
    })

    it('should ignore a deleted file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({config: {directory: gitDir}})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala2')

      const changes = await buildInfo.filesChangedSinceLastBuild({artifacts})
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: changes['a'],
      })

      await p(fs.unlink)(path.join(gitDir, 'a/a.txt'))

      const changesAfterDelete = await buildInfo.filesChangedSinceLastBuild({artifacts})
      expect(Object.keys(changesAfterDelete['a'])).to.have.members(['a/a.txt'])
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
