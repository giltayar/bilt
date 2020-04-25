'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {parse} = require('yaml')
const {writeFile, readFileAsString} = require('@bilt/scripting-commons')
const {
  prepareForSimpleBuild,
  runBuild,
  packageScriptCount,
  repoScriptCount,
} = require('../commons/setup-and-run')

describe('build-options (it)', function () {
  it('should use and allow overriding the values in .biltrc', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml', {
      jobDefaults: {build: {during1: false}},
    })

    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})

    await runBuild(cwd, 'a build with biltrc defaults', ['./a'], undefined)

    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(0)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(1)

    await runBuild(cwd, 'a build with biltrc defaults and an override', ['./a'], undefined, [
      '--during1',
      '--force',
    ])
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'during2')).to.equal(2)
  })

  it('should use and allow overriding the values in .biltrc', async () => {
    const cwd = await prepareForSimpleBuild('simple-build.yaml')

    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})

    await runBuild(cwd, 'a build with no before', ['./a'], undefined, ['--force', '--no-before'])
    expect(await repoScriptCount(cwd, 'before1')).to.equal(0)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(1)
    expect(await repoScriptCount(cwd, 'after1')).to.equal(1)

    await runBuild(cwd, 'a build with no after', ['./a'], undefined, ['--force', '--no-after'])
    expect(await repoScriptCount(cwd, 'before1')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(2)
    expect(await repoScriptCount(cwd, 'after1')).to.equal(1)

    await runBuild(cwd, 'a build with no envelope', ['./a'], undefined, [
      '--force',
      '--no-envelope',
    ])
    expect(await repoScriptCount(cwd, 'before1')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(3)
    expect(await repoScriptCount(cwd, 'after1')).to.equal(1)

    await runBuild(cwd, 'a build with no envelope, but before yes', ['./a'], undefined, [
      '--force',
      '--no-envelope',
      '--before',
    ])
    expect(await repoScriptCount(cwd, 'before1')).to.equal(2)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(4)
    expect(await repoScriptCount(cwd, 'after1')).to.equal(1)

    await runBuild(cwd, 'a build with no envelope, but after yes', ['./a'], undefined, [
      '--force',
      '--no-envelope',
      '--after',
    ])
    expect(await repoScriptCount(cwd, 'before1')).to.equal(2)
    expect(await packageScriptCount(cwd, 'a', 'during1')).to.equal(5)
    expect(await repoScriptCount(cwd, 'after1')).to.equal(2)
  })

  it('should enable creating a "jobs" configuration in the config file', async () => {
    const simpleBuildModified = parse(
      await readFileAsString(['../commons/simple-build.yaml'], {cwd: __dirname}),
    )
    simpleBuildModified.jobs.build.steps.before.push({
      name: 'beforex',
      run: 'echo $(expr $(cat beforex-count || echo 0) + 1) >beforex-count && cat beforex-count',
    })
    const cwd = await prepareForSimpleBuild('simple-build.yaml', {
      jobs: simpleBuildModified.jobs,
    })
    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})

    await runBuild(cwd, 'a build with no before', ['./a'])
    expect(await repoScriptCount(cwd, 'beforex')).to.equal(1)
  })
})
