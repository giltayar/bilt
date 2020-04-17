'use strict'
const path = require('path')
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {commitHistory} = require('@bilt/git-testkit')
const {
  writeFile,
  readFileAsString,
  readFileAsJson,
  sh,
  shWithOutput,
} = require('@bilt/scripting-commons')
const {
  prepareGitAndNpm,
  runBuild,
  createAdepsBdepsCPackages,
  packageScriptCount,
} = require('../commons/setup-and-run')

describe('build-options (it)', function () {
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
    // await new Promise(r => setTimeout(r, 5000000))
    expect(await shWithOutput('npm view a-package version', {cwd})).to.equal('2.0.0\n')
    expect(await packageScriptCount(cwd, 'a', 'test')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'build')).to.equal(1)
  })

  it('should override using the values in .biltrc', async () => {
    const {registry, cwd, pushTarget} = await prepareGitAndNpm()

    const beforeBuildHistory = Object.entries(await commitHistory(cwd))
    const beforeBuildPushedHistory = Object.entries(await commitHistory(pushTarget))

    await createPackage(cwd, registry, 'a', '2.0.0', {})
    await sh('npm publish', {cwd: path.join(cwd, 'a')})
    expect(await packageScriptCount(cwd, 'a', 'publish')).to.equal(1)

    await writeFile('.biltrc.json', {build: false, publish: false, git: false}, {cwd})

    await runBuild(cwd, 'a build with biltrc defaults', ['./a'], undefined)

    expect(Object.entries(await commitHistory(cwd)).length).to.equal(beforeBuildHistory.length)
    expect(Object.entries(await commitHistory(pushTarget)).length).to.equal(
      beforeBuildPushedHistory.length,
    )

    expect(await packageScriptCount(cwd, 'a', 'install')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'test')).to.equal(1)
    expect(await packageScriptCount(cwd, 'a', 'build')).to.equal(0)
    expect(await packageScriptCount(cwd, 'a', 'publish')).to.equal(1)

    await runBuild(cwd, 'a build with biltrc defaults and an override', ['./a'], undefined, [
      '--publish',
    ])
    expect(await packageScriptCount(cwd, 'a', 'install')).to.equal(2)
    expect(await packageScriptCount(cwd, 'a', 'test')).to.equal(2)
    expect(await packageScriptCount(cwd, 'a', 'build')).to.equal(0)
    expect(await packageScriptCount(cwd, 'a', 'publish')).to.equal(2)
  })

  it('should build using package names', async () => {
    const {registry, cwd} = await prepareGitAndNpm()
    const {cPackageJson, bPackageJson} = await createAdepsBdepsCPackages(cwd, registry)

    await writeFile('.biltrc.json', {packages: ['*']}, {cwd})

    await runBuild(cwd, 'first build', undefined, ['a-package'])
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
    await runBuild(cwd, 'second build', ['b-package', 'c-package'], ['a-package'])

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

    await runBuild(cwd, 'third build', undefined, ['./a'])
    expect(await readFileAsString(['a', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['b', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['c', 'build-count'], {cwd})).to.equal('1\n')
  })

  it('should use packages and uptos from biltrc', async () => {
    const {registry, cwd} = await prepareGitAndNpm()

    await createAdepsBdepsCPackages(cwd, registry, 'packages')

    await writeFile('.biltrc.json', {packages: ['./packages/*'], upto: ['b-package']}, {cwd})

    await runBuild(path.join(cwd, 'packages/c'), 'first build', ['.'])
    expect(await readFileAsString(['packages/a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['packages/b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['packages/c', 'build-count'], {cwd})).to.equal('1\n')

    await writeFile(['packages/a', 'build-now'], 'yes!', {cwd})
    await writeFile(['packages/b', 'build-now'], 'yes!', {cwd})
    await writeFile(['packages/c', 'build-now'], 'yes!', {cwd})

    await runBuild(path.join(cwd, 'packages/c'), 'second build', ['.'], undefined, ['--no-upto'])
    expect(await readFileAsString(['packages/a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['packages/b', 'build-count'], {cwd})).to.equal('1\n')
    expect(await readFileAsString(['packages/c', 'build-count'], {cwd})).to.equal('2\n')

    await runBuild(path.join(cwd, 'packages/c'), 'third build')
    expect(await readFileAsString(['packages/a', 'build-count'], {cwd})).to.equal('0')
    expect(await readFileAsString(['packages/b', 'build-count'], {cwd})).to.equal('2\n')
    expect(await readFileAsString(['packages/c', 'build-count'], {cwd})).to.equal('2\n')
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
  await writeFile([pkg, '.npmrc'], `registry=${registry}\n`, {cwd})
}
