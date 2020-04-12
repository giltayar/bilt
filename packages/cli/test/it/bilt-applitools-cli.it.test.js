'use strict'
const path = require('path')
const {describe, it} = require('mocha')
const {expect, use} = require('chai')
use(require('chai-subset'))
const {commitAll, commitHistory} = require('@bilt/git-testkit')
const {
  writeFile,
  shWithOutput,
  sh,
  readFileAsJson,
  readFileAsString,
} = require('@bilt/scripting-commons')
const {
  prepareGitAndNpm,
  runBuild,
  createAdepsBdepsCPackages,
  createPackages,
} = require('../commons/setup-and-run')

describe('applitools build (it)', function () {
  it(`should build two packages, first time, no dependencies,
      then build one if it changed,
      then not build because nothing changed`, async () => {
    const {registry, cwd, pushTarget} = await prepareGitAndNpm()

    await writeFile(['.biltrc.json'], {}, {cwd})
    await writeFile('.npmrc', `registry=${registry}\n`, {cwd})

    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})
    await writeFile(['a', '.npmrc'], `registry=${registry}\n`, {cwd})
    await sh('npm publish', {cwd: path.join(cwd, 'a')})

    await writeFile(['b', 'package.json'], {name: 'b-package', version: '2.0.0'}, {cwd})
    await writeFile(['b', '.npmrc'], `registry=${registry}\n`, {cwd})
    await sh('npm publish', {cwd: path.join(cwd, 'b')})

    await writeFile(['not-a-package', 'foo.txt'], 'foo', {cwd})

    await runBuild(cwd, 'first build', ['./a', './b'])

    const firstBuildHistory = Object.entries(await commitHistory(cwd))
    expect(firstBuildHistory).to.have.length(2)
    expect(firstBuildHistory[0][1]).to.have.members([
      'a/.npmrc',
      'a/package.json',
      'a/package-lock.json',
      'b/.npmrc',
      'b/package.json',
      'b/package-lock.json',
    ])

    expect(await shWithOutput('npm view a-package version', {cwd})).to.eql('1.0.1\n')
    expect(await shWithOutput('npm view b-package version', {cwd})).to.eql('2.0.1\n')

    await writeFile(['a', 'a.txt'], 'touching a', {cwd})
    await commitAll(cwd, 'second commit to build')

    await runBuild(cwd, 'second build', ['./a', './b'])
    const history = Object.entries(await commitHistory(cwd))
    expect(history).to.have.length(firstBuildHistory.length + 2)

    expect(history[0][1]).to.have.members(['a/package.json', 'a/package-lock.json'])

    expect(await shWithOutput('npm view a-package version', {cwd})).to.eql('1.0.2\n')
    expect(await shWithOutput('npm view b-package version', {cwd})).to.eql('2.0.1\n')

    const pushedHistory = await commitHistory(pushTarget)

    expect(Object.entries(pushedHistory)[0][1]).to.have.members([
      'a/package.json',
      'a/package-lock.json',
    ])

    await runBuild(cwd, 'third build')
    const noBuildHistory = Object.entries(await commitHistory(cwd))
    expect(noBuildHistory).to.have.length(history.length)
  })

  it('should build packages with dependencies correctly', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    const {cPackageJson, bPackageJson} = await createAdepsBdepsCPackages(cwd, registry)

    await runBuild(cwd, 'first build', undefined, ['./a'])
    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsJson(['b', 'c-package.json'], {cwd})).to.containSubset({
      ...cPackageJson,
      version: '3.0.1',
    })
    expect(await readFileAsJson(['a', 'b-package.json'], {cwd})).to.containSubset({
      ...bPackageJson,
      version: '2.0.1',
    })

    await writeFile(['b', 'build-this'], 'yes!', {cwd})
    await runBuild(cwd, 'second build', undefined, ['./a'])
    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsJson(['b', 'c-package.json'], {cwd})).to.containSubset({
      ...cPackageJson,
      version: '3.0.1',
    })
    expect(await readFileAsJson(['a', 'b-package.json'], {cwd})).to.containSubset({
      ...bPackageJson,
      version: '2.0.2',
    })

    await runBuild(cwd, 'second build', undefined, ['./a'])
    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should not commit failed packages and packages not built', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    const {bPackageJson} = await createAdepsBdepsCPackages(cwd, registry)

    await writeFile(['a', 'build-this'], 'yes!', {cwd})
    await writeFile(['b', 'build-this'], 'yes!', {cwd})
    await writeFile(['c', 'build-this'], 'yes!', {cwd})

    const numberOfCommitsBeforeBuild = Object.keys(await commitHistory(cwd)).length

    // make b fail
    await writeFile(
      ['b', 'package.json'],
      {
        ...bPackageJson,
        scripts: {...bPackageJson.scripts, build: `${bPackageJson.scripts.build} && false`},
      },
      {cwd},
    )

    // first build - b fails, a isnt run at all
    await runBuild(cwd)
    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')

    const historyAfterBuild = Object.entries(await commitHistory(cwd))
    const numberOfCommitsAfterBuild = historyAfterBuild.length

    expect(numberOfCommitsAfterBuild).to.equal(numberOfCommitsBeforeBuild + 1)
    expect(historyAfterBuild[0][1]).eql([
      'c/.npmrc',
      'c/build-count',
      'c/build-this',
      'c/package-lock.json',
      'c/package.json',
    ])

    // make b succeed
    await writeFile(
      ['b', 'package.json'],
      {
        ...bPackageJson,
        scripts: {...bPackageJson.scripts, build: bPackageJson.scripts.build},
      },
      {cwd},
    )

    await runBuild(cwd, 'last build', undefined, ['./a'])
    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should ignore packages not in "packages"', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)

    await runBuild(cwd, 'first build', ['./c'], [])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')

    await runBuild(cwd, 'second build', ['./b'], ['./a'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should ignore packages not in the "project (i.e. not leading to the uptos)', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)
    await createPackages(cwd, registry, 'd', 'e', 'f')

    await runBuild(cwd, 'build abc project', undefined, ['./a'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['d', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['e', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['f', 'build-count'], {cwd})).to.equal('0')

    await runBuild(cwd, 'build def project', undefined, ['./d'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['d', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['e', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['f', 'build-count'], {cwd})).to.equal('1\n')
  })
})
