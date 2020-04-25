'use strict'
const {promisify: p} = require('util')
const path = require('path')
const {describe, it} = require('mocha')
const {expect, use} = require('chai')
use(require('chai-subset'))
const {writeFile} = require('@bilt/scripting-commons')
const {
  runBuild,
  createAdepsBdepsCPackages,
  createPackages,
  packageScriptCount,
  packageScriptTime,
  repoScriptCount,
  prepareForSimpleBuild,
} = require('../commons/setup-and-run')

describe('build-flow (it)', function () {
  it(`should build two packages, first time, no dependencies,
      then build one if it changed,
      then not build because nothing changed`, async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml')

    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})
    await writeFile(['b', 'package.json'], {name: 'b-package', version: '2.0.0'}, {cwd})
    await writeFile(['not-a-package', 'foo.txt'], 'foo', {cwd})

    await runBuild(cwd, 'first build', ['./a', './b'])

    expect(await repoScriptCount(cwd, 'before1')).to.eql(1)
    expect(await repoScriptCount(cwd, 'after1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.eql(1)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.eql(1)

    await writeFile(['a', 'a.txt'], 'touching a', {cwd})
    await runBuild(cwd, 'second build, just a', ['./a', './b'])

    expect(await repoScriptCount(cwd, 'before1')).to.eql(2)
    expect(await repoScriptCount(cwd, 'after1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.eql(2)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.eql(1)

    await runBuild(cwd, 'third build, no change', ['*'])

    expect(await repoScriptCount(cwd, 'before1')).to.eql(2)
    expect(await repoScriptCount(cwd, 'after1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.eql(2)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.eql(1)
  })

  it('should build packages with dependencies correctly', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml')
    await createAdepsBdepsCPackages(cwd)

    await runBuild(cwd, 'first build', ['*'], ['./a'])
    expect(await repoScriptCount(cwd, 'before1')).to.eql(1)
    expect(await repoScriptCount(cwd, 'after1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.eql(1)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.eql(1)
    expect(await packageScriptCount(cwd, 'c', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.eql(1)
    expect(await packageScriptTime(cwd, 'a', 'during1')).to.be.gt(
      await packageScriptTime(cwd, 'b', 'during1'),
    )
    expect(await packageScriptTime(cwd, 'b', 'during1')).to.be.gt(
      await packageScriptTime(cwd, 'c', 'during1'),
    )

    await writeFile(['b', 'build-this'], 'yes!', {cwd})
    await runBuild(cwd, 'second build, build b and thus a', ['*'], ['./a'])
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'c', 'during1')).to.eql(1)
    expect(await packageScriptTime(cwd, 'a', 'during1')).to.be.gt(
      await packageScriptTime(cwd, 'b', 'during1'),
    )

    await runBuild(cwd, 'third build, no change', ['*'], ['./a'])
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'c', 'during1')).to.eql(1)
    expect(await packageScriptTime(cwd, 'a', 'during1')).to.be.gt(
      await packageScriptTime(cwd, 'b', 'during1'),
    )
  })

  it('should run after if at least one succeeded, but not if none succeeded', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml')
    await createAdepsBdepsCPackages(cwd)

    await writeFile(['b', 'fail'], '', {cwd})

    // first build - b fails, a isnt run at all
    await runBuild(cwd, 'failed build 1 (c succeeds)', ['*'])
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(0)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.eql(0)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.eql(0)
    expect(await packageScriptCount(cwd, 'c', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.eql(1)

    expect(await repoScriptCount(cwd, 'after1')).to.eql(1)

    // first build - b fails, a isnt run at all
    await runBuild(cwd, 'failed build 2 (c not built)', ['*'])
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(0)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.eql(0)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(2)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.eql(0)
    expect(await packageScriptCount(cwd, 'c', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.eql(1)

    expect(await repoScriptCount(cwd, 'after1')).to.eql(1)

    await runBuild(cwd, 'last build', ['*'], ['./a'], ['--no-fail'])
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.eql(1)
    expect(await packageScriptCount(cwd, 'b', 'during1')).to.eql(3)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.eql(1)
    expect(await packageScriptCount(cwd, 'c', 'during1')).to.eql(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.eql(1)
  })

  it('--force should work and also build dependencies', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml', {packages: ['./a', './b', './c']})
    await createAdepsBdepsCPackages(cwd)

    await runBuild(cwd, 'build all')

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)

    await runBuild(cwd, 'build nothing because nothing changed')

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)

    await runBuild(cwd, 'build c, b, and a because force', ['./c'], ['./a'], ['--force'])

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(2)
  })

  it('should build dependencies even if not dirty because lower package was built', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml', {packages: ['./a', './b', './c']})
    await createAdepsBdepsCPackages(cwd)

    await runBuild(cwd, 'build all')

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)

    // we have to wait one second for the time of the commit of c to be different than the others
    await p(setTimeout)(1000)

    await runBuild(cwd, 'build c, forced', ['./c'], undefined, ['--force', '--no-upto'])

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(2)

    await runBuild(cwd, 'build b,a because c changed in previous build')

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(2)
  })

  it('should ignore packages not in "packages" and add upto packages to packages to build', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml')
    await createAdepsBdepsCPackages(cwd)

    await runBuild(cwd, 'first build', ['./c'])

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(0)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(0)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)

    await runBuild(cwd, 'second build', ['./b'], ['./a'])

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)
  })

  it('should ignore packages not in the "project (i.e. not leading to the uptos)', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml')
    await createAdepsBdepsCPackages(cwd)
    await createPackages(cwd, undefined, 'd', 'e', 'f')

    await runBuild(cwd, 'build abc project', ['*'], ['./a'])

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'd', 'during2')).to.equal(0)
    expect(await packageScriptCount(cwd, 'e', 'during2')).to.equal(0)
    expect(await packageScriptCount(cwd, 'f', 'during2')).to.equal(0)

    await runBuild(cwd, 'build def project', ['*'], ['./d'])

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'd', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'e', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'f', 'during2')).to.equal(1)
  })

  it('should build using package names', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml', {packages: ['*']})
    await createAdepsBdepsCPackages(cwd)

    await runBuild(cwd, 'first build', undefined, ['a-package'])
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)

    await writeFile(['b', 'build-this'], 'yes!', {cwd})
    await runBuild(cwd, 'second build', ['b-package', 'c-package'], ['a-package'])

    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)

    await runBuild(cwd, 'third build', undefined, ['./a'])
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'b', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'c', 'during2')).to.equal(1)
  })

  it('should use packages and uptos from biltrc', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml', {
      packages: ['./packages/*'],
      upto: ['b-package'],
    })
    await createAdepsBdepsCPackages(cwd, undefined, 'packages')

    await runBuild(path.join(cwd, 'packages/c'), 'first build', ['.'])
    expect(await packageScriptCount(cwd, 'packages/a', 'during2')).to.equal(0)
    expect(await packageScriptCount(cwd, 'packages/b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'packages/c', 'during2')).to.equal(1)

    await writeFile(['packages/a', 'build-now'], 'yes!', {cwd})
    await writeFile(['packages/b', 'build-now'], 'yes!', {cwd})
    await writeFile(['packages/c', 'build-now'], 'yes!', {cwd})

    await runBuild(path.join(cwd, 'packages/c'), 'second build', ['.'], undefined, ['--no-upto'])
    expect(await packageScriptCount(cwd, 'packages/a', 'during2')).to.equal(0)
    expect(await packageScriptCount(cwd, 'packages/b', 'during2')).to.equal(1)
    expect(await packageScriptCount(cwd, 'packages/c', 'during2')).to.equal(2)

    await runBuild(path.join(cwd, 'packages/c'), 'third build')
    expect(await packageScriptCount(cwd, 'packages/a', 'during2')).to.equal(0)
    expect(await packageScriptCount(cwd, 'packages/b', 'during2')).to.equal(2)
    expect(await packageScriptCount(cwd, 'packages/c', 'during2')).to.equal(2)
  })

  it('should run with non-default jobId in an extends folder (and one of the phases is missing)', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml')

    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})

    await runBuild(cwd, 'first build', ['./a'], undefined, [], 'another-build')
    expect(await packageScriptCount(cwd, 'a', 'another-during1')).to.equal(1)
    expect(await repoScriptCount(cwd, 'another-after1')).to.equal(1)

    await runBuild(
      cwd,
      'first build',
      ['./a'],
      undefined,
      ['--force', '--no-anotherDuring1'],
      'another-build',
    )
    expect(await packageScriptCount(cwd, 'a', 'another-during1')).to.equal(1)
    expect(await repoScriptCount(cwd, 'another-after1')).to.equal(2)
  })
})
