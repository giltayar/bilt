'use strict'
const path = require('path')
const {describe, it} = require('mocha')
const {expect, use} = require('chai')
use(require('chai-subset'))
const {commitAll, commitHistory} = require('@bilt/git-testkit')
const {enablePackageToPublishToRegistry} = require('@bilt/npm-testkit')
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
  packageScriptCount,
} = require('../commons/setup-and-run')

describe('default-build (it)', function () {
  it(`should build two packages, first time, no dependencies,
      then build one if it changed,
      then not build because nothing changed`, async () => {
    const {registry, cwd, pushTarget} = await prepareGitAndNpm()

    await writeFile(['.biltrc.json'], {}, {cwd})
    await enablePackageToPublishToRegistry(cwd, registry)

    await writeFile(['a', 'package.json'], {name: 'a-package', version: '1.0.0'}, {cwd})
    await enablePackageToPublishToRegistry(path.join(cwd, 'a'), registry)
    await sh('npm publish', {cwd: path.join(cwd, 'a')})

    await writeFile(['b', 'package.json'], {name: 'b-package', version: '2.0.0'}, {cwd})
    await enablePackageToPublishToRegistry(path.join(cwd, 'b'), registry)
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

    await runBuild(cwd, 'third build', ['*'])
    const noBuildHistory = Object.entries(await commitHistory(cwd))
    expect(noBuildHistory).to.have.length(history.length)
  })

  it('should build packages with dependencies correctly (and check extends: #default', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    const {cPackageJson, bPackageJson} = await createAdepsBdepsCPackages(cwd, registry)

    await writeFile('.biltrc.json', {jobs: './extends-default.json'}, {cwd})
    await writeFile('extends-default.json', {extends: '#default', jobs: {}}, {cwd})

    await runBuild(cwd, 'first build', ['*'], ['./a'])
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
    await runBuild(cwd, 'second build', ['*'], ['./a'])
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

    await runBuild(cwd, 'second build', ['*'], ['./a'])
    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should disable all git stuff when --no-git, and test all build options', async () => {
    const {registry, cwd, pushTarget} = await prepareGitAndNpm()

    const beforeBuildHistory = Object.entries(await commitHistory(cwd))
    const beforeBuildPushedHistory = Object.entries(await commitHistory(pushTarget))

    await createPackage(cwd, registry, 'b', '1.0.0')
    await sh('npm publish', {cwd: path.join(cwd, 'b')})
    await createPackage(cwd, registry, 'a', '2.0.0', {}, {'b-package': '^1.0.0'})

    await runBuild(cwd, 'a build without git', ['./a'], undefined, ['--no-git'])

    expect(Object.entries(await commitHistory(cwd)).length).to.equal(beforeBuildHistory.length)
    expect(Object.entries(await commitHistory(pushTarget)).length).to.equal(
      beforeBuildPushedHistory.length,
    )

    expect(await packageScriptCount(cwd, 'a', 'install')).to.equal(1)
    expect(await packageDependency(cwd, 'a', 'b-package')).to.equal('1.0.0')
    expect(await packageScriptCount(cwd, 'a', 'test')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'build')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'publish')).to.equal(1)

    // now publish package b to 1.0.1
    await runBuild(cwd, 'b build', ['./b'], undefined, ['--no-git'])

    // now remove all steps but update
    await runBuild(cwd, 'a build wihtout anything except update', ['./a'], undefined, [
      '--no-git',
      '--no-test',
      '--no-audit',
      '--no-install',
      '--no-publish',
      '--no-build',
    ])

    expect(await packageScriptCount(cwd, 'a', 'install')).to.equal(1)
    expect(await packageDependency(cwd, 'a', 'b-package')).to.equal('1.0.1')
    expect(await shWithOutput('npm view a-package version', {cwd})).to.equal('2.0.0\n')
    expect(await packageScriptCount(cwd, 'a', 'test')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'build')).to.equal(1)
  })
})

/**
 * @param {string} cwd
 * @param {string} pkg
 * @param {string} dependency
 * @returns {Promise<string>}
 */
async function packageDependency(cwd, pkg, dependency) {
  return (await readFileAsJson([pkg, 'package-lock.json'], {cwd})).dependencies[dependency].version
}

async function createPackage(
  cwd,
  registry,
  pkg,
  version = '1.0.0',
  scripts = {},
  dependencies = {},
) {
  const scriptScript = async (name) => {
    await writeFile([pkg, `${name}-count`], '0', {cwd})

    return `echo $(expr $(cat ${name}-count) + 1) >${name}-count`
  }

  await writeFile(
    [pkg, 'package.json'],
    {
      name: `${pkg}-package`,
      version,
      scripts: {
        postinstall: await scriptScript('install'),
        postupdate: await scriptScript('update'),
        // postaudit: await scriptScript('audit'), // unfortunately, postaudit doesn't work
        build: await scriptScript('build'),
        test: await scriptScript('test'),
        postpublish: await scriptScript('publish'),
        ...scripts,
      },
      dependencies,
    },
    {cwd},
  )
  await enablePackageToPublishToRegistry(path.join(cwd, pkg), registry)
}
