'use strict'
const path = require('path')
const {describe, it} = require('mocha')
const {expect, use} = require('chai')
use(require('chai-subset'))
const {init, commitAll, commitHistory} = require('@bilt/git-testkit')
const {startNpmRegistry} = require('@bilt/npm-testkit')
const {
  makeTemporaryDirectory,
  writeFile,
  shWithOutput,
  sh,
  readFileAsJson,
  readFileAsString,
} = require('@bilt/scripting-commons')

const applitoolsBuild = require('../../src/cli')

describe('applitools build', function () {
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

    await runBuild(cwd, 'first build', ['a', 'b'])

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

    await runBuild(cwd, 'second build', ['a', 'b'])
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

    await runBuild(cwd, 'first build', undefined, ['a'])
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
    await runBuild(cwd, 'second build', undefined, ['a'])
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

    await runBuild(cwd, 'second build', undefined, ['a'])
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

    await runBuild(cwd, 'last build', undefined, ['a'])
    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should ignore packages not in [packages]', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)

    await runBuild(cwd, 'first build', ['c'], [])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')

    await runBuild(cwd, 'first build', ['b'], ['a'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should ignore packages not in the "project (i.e. not leading to the uptos)', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    await createAdepsBdepsCPackages(cwd, registry)
    await createPackages(cwd, registry, 'd', 'e', 'f')

    await runBuild(cwd, 'build abc project', undefined, ['a'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['d', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['e', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['f', 'build-count'], {cwd})).to.equal('0')

    await runBuild(cwd, 'build def project', undefined, ['d'])

    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['d', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['e', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['f', 'build-count'], {cwd})).to.equal('1\n')
  })
})

async function createAdepsBdepsCPackages(cwd, registry) {
  await writeFile(['.biltrc.json'], {}, {cwd})
  await writeFile('.npmrc', `registry=${registry}\n`, {cwd})
  const {cPackageJson, bPackageJson} = await createPackages(cwd, registry, 'a', 'b', 'c')
  return {cPackageJson, bPackageJson}
}

async function createPackages(cwd, registry, aPackage, bPackage, cPackage) {
  const build = `echo $(expr $(cat build-count) + 1) >build-count`
  await writeFile(
    [aPackage, 'package.json'],
    {
      name: `${aPackage}-package`,
      version: '1.0.0',
      dependencies: {[`${bPackage}-package`]: '^2.0.0'},
      scripts: {
        test: `cp node_modules/${bPackage}-package/package.json ./${bPackage}-package.json`,
        build,
      },
    },
    {cwd},
  )
  await writeFile([aPackage, 'build-count'], '0', {cwd})
  await writeFile([aPackage, '.npmrc'], `registry=${registry}\n`, {cwd})
  const bPackageJson = {
    name: `${bPackage}-package`,
    version: '2.0.0',
    dependencies: {[`${cPackage}-package`]: '^3.0.0'},
    scripts: {
      test: `cp node_modules/${cPackage}-package/package.json ./${cPackage}-package.json`,
      build,
    },
  }
  await writeFile([bPackage, 'package.json'], bPackageJson, {cwd})
  await writeFile([bPackage, '.npmrc'], `registry=${registry}\n`, {cwd})
  await writeFile([bPackage, 'build-count'], '0', {cwd})
  await sh('npm publish', {cwd: path.join(cwd, bPackage)})
  const cPackageJson = {name: `${cPackage}-package`, version: '3.0.0', scripts: {build}}
  await writeFile([cPackage, 'package.json'], cPackageJson, {cwd})

  await writeFile([cPackage, '.npmrc'], `registry=${registry}\n`, {cwd})

  await writeFile([cPackage, 'build-count'], '0', {cwd})

  await sh('npm publish', {cwd: path.join(cwd, cPackage)})

  return {cPackageJson, bPackageJson}
}

async function prepareGitAndNpm() {
  const cwd = await makeTemporaryDirectory()
  const pushTarget = await makeTemporaryDirectory()
  await init(pushTarget, {bare: true})
  await init(cwd, {origin: pushTarget})
  const {registry} = await startNpmRegistry()

  return {registry, cwd, pushTarget}
}

/**
 * @param {string} cwd
 * @param {string} [message]
 * @param {string[]} [packages]
 * @param {string[]} [uptos]
 */
async function runBuild(cwd, message, packages = undefined, uptos = undefined) {
  await applitoolsBuild([
    '--config',
    path.join(cwd, '.biltrc.json'),
    ...(packages && packages.length > 0 ? packages : []),
    '-m',
    message,
    ...(uptos && uptos.length > 0 ? ['--upto', ...uptos] : []),
  ])
}
