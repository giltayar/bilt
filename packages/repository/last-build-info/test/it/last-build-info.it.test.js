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
  const filesChanged = async (buildInfo, artifacts) => {
    const filesChanged = await buildInfo.filesChangedSinceLastBuild({
      lastBuildInfo: await buildInfo.lastBuildInfo({artifacts}),
    })

    for (const {path: artifactPath} of artifacts) {
      await buildInfo.savePrebuildBuildInfo({
        artifactPath,
        artifactFilesChangedSinceLastBuild: filesChanged[artifactPath],
      })
    }

    return filesChanged
  }

  describe('repo changes', () => {
    it('should enable saving and re-reading on an initial folder', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      const changes = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(changes)).to.have.members(['a', 'b'])
      expect(changes.b).to.be.undefined
      expect(Object.keys(changes.a)).to.have.members([])
    })

    it('should show no changes in files on an untouched workspace', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      const changes = await filesChanged(buildInfo, artifacts)
      expect(changes).to.eql({
        a: undefined,
        b: undefined,
      })
    })

    it('should show no changes in files after a commit ', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      const fcslb = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(fcslb['a'])).to.eql(['a/a.txt'])
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'b'})
      const fcslb2 = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(fcslb2['a'])).to.eql([])

      await p(execFile)('git', ['add', '.'], {cwd: gitDir})
      await p(execFile)('git', ['commit', '-m', 'sadfsaf'], {cwd: gitDir})

      const fcslb3 = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(fcslb3['a'])).to.eql([])
      expect(Object.keys(fcslb3['b'])).to.eql([])
    })

    it('should return timestamp of packages', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]
      const now = new Date()

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a', now})

      const res = await buildInfo.artifactBuildTimestamps({
        lastBuildInfo: await buildInfo.lastBuildInfo({artifacts}),
      })

      expect(res).to.eql({a: now, b: undefined})
    })

    it('should not show file changes even if we change, if there was no previous save', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      expect(await filesChanged(buildInfo, artifacts)).to.eql({
        a: undefined,
        b: undefined,
      })
    })

    it('should show file changes if we change a file in one artifact, if there was a previous save for that artifact', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      const changes = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(changes)).to.have.members(['a', 'b'])
      expect(changes.b).to.be.undefined
      expect(Object.keys(changes.a)).to.have.members(['a/a.txt'])
    })

    it('should show file changes in an added file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      const changes = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(changes)).to.have.members(['a', 'b'])
      expect(changes.b).to.be.undefined
      expect(Object.keys(changes.a)).to.have.members(['a/c.txt', 'a/a.txt'])
    })

    it('should show only changed files if on same commit', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      const changes = await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({
        artifactPath: 'a',
        artifactFilesChangedSinceLastBuild: changes['a'],
      })
      const changes2 = await filesChanged(buildInfo, artifacts)

      expect(Object.keys(changes2['a'])).to.eql([])
    })

    it('should work even if has more than one commit', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      await p(execFile)('git', ['add', '.'], {cwd: gitDir})
      await p(execFile)('git', ['commit', '-m', 'sadfsaf'], {cwd: gitDir})

      await p(fs.writeFile)(path.join(gitDir, 'a/d.txt'), 'zzz')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'abc')

      const changes = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(changes['a'])).to.have.members(['a/a.txt', 'a/c.txt', 'a/d.txt'])

      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      const changes2 = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(changes2['a'])).to.eql([])
    })

    it('should rebuild a reverted file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      const changes = await filesChanged(buildInfo, artifacts)
      expect(changes['a']).to.be.undefined
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      await p(execFile)('git', ['checkout', '--', 'a/a.txt'], {cwd: gitDir})

      const changesAfterRevert = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(changesAfterRevert['a'])).to.eql(['a/a.txt'])
    })

    it('should deal with no changes after a first build', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala2')

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      const changesAfterBuild = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(changesAfterBuild['a'])).to.eql([])
    })

    it('should ignore a deleted file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const buildInfo = await buildInfoMaker({directory: gitDir})
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala2')

      await filesChanged(buildInfo, artifacts)
      await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

      await p(fs.unlink)(path.join(gitDir, 'a/a.txt'))

      const changesAfterDelete = await filesChanged(buildInfo, artifacts)
      expect(Object.keys(changesAfterDelete['a'])).to.have.members(['a/a.txt'])
    })

    describe('multi-package changes', () => {
      it('should silo each package change to its own package', async () => {
        const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
        const buildInfo = await buildInfoMaker({directory: gitDir})
        const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

        await p(fs.writeFile)(path.join(gitDir, 'b/b.txt'), 'lalala1')

        await filesChanged(buildInfo, artifacts)
        for (const artifactPath of ['a', 'b'])
          await buildInfo.savePackageLastBuildInfo({artifactPath})

        await p(fs.writeFile)(path.join(gitDir, 'b/b.txt'), 'lalala2')

        const changes2 = await filesChanged(buildInfo, artifacts)
        expect(changes2['a']).to.eql({})
        expect(changes2['b']).to.have.keys(['b/b.txt'])
      })
    })

    describe('.biltignore', () => {
      it('should work in root', async () => {
        const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
        const buildInfo = await buildInfoMaker({directory: gitDir})
        const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

        await filesChanged(buildInfo, artifacts)
        await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})

        await p(fs.writeFile)(path.join(gitDir, 'a/ignore.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'a/not-ignore.txt'), 'lalala')

        const changes2 = await filesChanged(buildInfo, artifacts)
        expect(Object.keys(changes2['a'])).to.eql(['a/not-ignore.txt'])
      })

      it('should override in subfolder (also multiple packages saved...)', async () => {
        const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
        const buildInfo = await buildInfoMaker({directory: gitDir})
        const artifacts = [{name: 'a', path: 'a'}, {name: 'ignoramus', path: 'ignoramus'}]

        await filesChanged(buildInfo, artifacts)
        await buildInfo.savePackageLastBuildInfo({artifactPath: 'a'})
        await buildInfo.savePackageLastBuildInfo({artifactPath: 'ignoramus'})

        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/ignore.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/more/ignore.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/a.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/dontignore.txt'), 'lalala')

        const changesAfterSecond = await filesChanged(buildInfo, artifacts)

        expect(Object.keys(changesAfterSecond['ignoramus'])).to.have.members([
          'ignoramus/dontignore.txt',
          'ignoramus/a.txt',
          'ignoramus/more/ignore.txt',
        ])
        expect(Object.keys(changesAfterSecond['a'])).to.eql(['a/a.txt'])
      })
    })
  })
})
