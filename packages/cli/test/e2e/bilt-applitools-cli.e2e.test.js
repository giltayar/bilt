'use strict'
const path = require('path')
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {readFileAsString} = require('@bilt/scripting-commons')
const {
  prepareGitAndNpm,
  runBuildCli,
  createAdepsBdepsCPackages,
} = require('../commons/setup-and-run')

describe('applitools build (e2e)', function () {
  it(`build package in current directory, then build the rest`, async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)

    await runBuildCli(path.join(cwd, 'c'), 'build c in its own directory', ['.'], [])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')

    await runBuildCli(cwd, 'build all', undefined, ['a'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })
})
