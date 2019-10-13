'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')
const fs = require('fs')
const path = require('path')
const {execFile} = require('child_process')
const {promisify: p} = require('util')
const {setupBuildDir} = require('../utils/setup')
const {
  lastBuildInfo,
  artifactBuildTimestamps,
  filesChangedSinceLastBuild,
  copyPrebuildToLastBuildInfo,
  saveBuildInfo,
} = require('../..')

describe('last-build-info', () => {
  async function buildAll(repositoryDirectory, artifacts, {now} = {}) {
    const filesChanged = await filesChangedSinceLastBuild({
      repositoryDirectory,
      lastBuildInfo: await lastBuildInfo({repositoryDirectory, artifacts}),
    })

    for (const artifact of artifacts) {
      await saveBuildInfo({repositoryDirectory, artifact, isPrebuild: true})
    }

    const artifactPathsBuilt = []
    for (const {path: artifactPath} of artifacts.filter(
      ({path: artifactPath}) =>
        filesChanged[artifactPath] === undefined ||
        Object.keys(filesChanged[artifactPath]).length > 0,
    )) {
      await copyPrebuildToLastBuildInfo({repositoryDirectory, artifactPath, now})
      artifactPathsBuilt.push(artifactPath)
    }

    return {
      filesChanged: [].concat(
        Object.values(filesChanged).map(fileToHashObject =>
          fileToHashObject ? Object.keys(fileToHashObject) : fileToHashObject,
        ),
      ),
      artifactPathsBuilt,
    }
  }

  describe('repo changes', () => {
    it('should build all first time and then no need to rebuild anything', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [undefined, undefined],
        artifactPathsBuilt: ['a', 'b'],
      })

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [[], []],
        artifactPathsBuilt: [],
      })
    })

    it('should deal correctly with changes that occur twice after build', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await buildAll(gitDir, artifacts)

      await p(fs.writeFile)(path.join(gitDir, 'a/new-file.txt'), 'lalala')

      await buildAll(gitDir, artifacts)

      await p(fs.writeFile)(path.join(gitDir, 'a/newer-file.txt'), 'lalala')

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [['a/newer-file.txt'], []],
        artifactPathsBuilt: ['a'],
      })

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [[], []],
        artifactPathsBuilt: [],
      })
    })

    it('should show no changes in files after a commit ', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await buildAll(gitDir, artifacts)

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [['a/a.txt'], []],
        artifactPathsBuilt: ['a'],
      })

      await p(execFile)('git', ['add', '.'], {cwd: gitDir})
      await p(execFile)('git', ['commit', '-m', 'sadfsaf'], {cwd: gitDir})

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [[], []],
        artifactPathsBuilt: [],
      })
    })

    it('should return timestamp of packages', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]
      const now = new Date()

      await buildAll(gitDir, artifacts, {now})

      const res = await artifactBuildTimestamps({
        repositoryDirectory: gitDir,
        lastBuildInfo: await lastBuildInfo({repositoryDirectory: gitDir, artifacts}),
      })

      expect(res).to.eql({a: now, b: now})
    })

    it('should not show file changes even if we change, if there was no previous save', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [undefined, undefined],
        artifactPathsBuilt: ['a', 'b'],
      })
    })

    it('should show file changes in an added file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await buildAll(gitDir, artifacts)

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [['a/c.txt', 'a/a.txt'], []],
        artifactPathsBuilt: ['a'],
      })
    })

    it('should work even if has more than one commit', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await buildAll(gitDir, artifacts)

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      await p(execFile)('git', ['add', '.'], {cwd: gitDir})
      await p(execFile)('git', ['commit', '-m', 'sadfsaf'], {cwd: gitDir})

      await p(fs.writeFile)(path.join(gitDir, 'a/d.txt'), 'zzz')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'abc')

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [['a/d.txt', 'a/c.txt', 'a/a.txt'], []],
        artifactPathsBuilt: ['a'],
      })

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [[], []],
        artifactPathsBuilt: [],
      })
    })

    it('should rebuild a reverted file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala')

      await buildAll(gitDir, artifacts)

      await p(execFile)('git', ['checkout', '--', 'a/a.txt'], {cwd: gitDir})

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [['a/a.txt'], []],
        artifactPathsBuilt: ['a'],
      })
    })

    it('should deal with no changes after a first build', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala2')

      await buildAll(gitDir, artifacts)

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [[], []],
        artifactPathsBuilt: [],
      })
    })

    it('should not ignore a deleted file', async () => {
      const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

      await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
      await p(fs.writeFile)(path.join(gitDir, 'a/c.txt'), 'lalala2')

      await buildAll(gitDir, artifacts)

      await p(fs.unlink)(path.join(gitDir, 'a/a.txt'))

      expect(await buildAll(gitDir, artifacts)).to.eql({
        filesChanged: [['a/a.txt'], []],
        artifactPathsBuilt: ['a'],
      })
    })

    describe('multi-package changes', () => {
      it('should silo each package change to its own package', async () => {
        const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
        const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

        await p(fs.writeFile)(path.join(gitDir, 'b/b.txt'), 'lalala1')

        await buildAll(gitDir, artifacts)

        await p(fs.writeFile)(path.join(gitDir, 'b/b.txt'), 'lalala2')
        await p(fs.writeFile)(path.join(gitDir, 'a/b.txt'), 'lalala2')

        expect(await buildAll(gitDir, artifacts)).to.eql({
          filesChanged: [['a/b.txt'], ['b/b.txt']],
          artifactPathsBuilt: ['a', 'b'],
        })
      })
    })

    describe('.biltignore', () => {
      it('should work in root', async () => {
        const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
        const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}]

        await buildAll(gitDir, artifacts)

        await p(fs.writeFile)(path.join(gitDir, 'a/ignore.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'a/not-ignore.txt'), 'lalala')

        expect(await buildAll(gitDir, artifacts)).to.eql({
          filesChanged: [['a/not-ignore.txt'], []],
          artifactPathsBuilt: ['a'],
        })
      })

      it('should override in subfolder (also multiple packages saved...)', async () => {
        const gitDir = await setupBuildDir(path.join(__dirname, 'last-build-info/test-folder'))
        const artifacts = [{name: 'a', path: 'a'}, {name: 'ignoramus', path: 'ignoramus'}]

        await buildAll(gitDir, artifacts)

        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/ignore.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/more/ignore.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/a.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'a/a.txt'), 'lalala')
        await p(fs.writeFile)(path.join(gitDir, 'ignoramus/dontignore.txt'), 'lalala')

        expect(await buildAll(gitDir, artifacts)).to.eql({
          filesChanged: [
            ['a/a.txt'],
            ['ignoramus/a.txt', 'ignoramus/dontignore.txt', 'ignoramus/more/ignore.txt'],
          ],
          artifactPathsBuilt: ['a', 'ignoramus'],
        })
      })
    })
  })
})
