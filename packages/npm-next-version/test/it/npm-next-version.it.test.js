'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')
const {startNpmRegistry, enablePackageToPublishToRegistry} = require('@bilt/npm-testkit')
const {makeTemporaryDirectory, writeFile, sh} = require('@bilt/scripting-commons')

const {npmNextVersion} = require('../..')

describe('npmNextVersion (it)', function () {
  it('should work', async () => {
    expect(
      await npmNextVersion({
        name: '@bilt/package-that-is-for-testing-npm-next-version',
        version: '1.4.5',
      }),
    ).to.equal('1.4.7')
  })

  it('should work with non-existing  package', async () => {
    expect(
      await npmNextVersion({
        name: '@bilt/package-that-does-not-exist',
        version: '1.0.0',
      }),
    ).to.equal('1.0.0')
  })

  it("should use packageDirectory so that the package's .npmrc will prevail", async () => {
    const packageDirectory = await makeTemporaryDirectory()
    const {registry, close} = await startNpmRegistry()

    try {
      await writeFile(
        'package.json',
        {name: 'some-package', version: '1.2.3'},
        {cwd: packageDirectory},
      )

      await writeFile('.npmrc', `registry=${registry}/\n`, {cwd: packageDirectory})
      await enablePackageToPublishToRegistry(packageDirectory, registry)

      await sh('npm publish', {cwd: packageDirectory})

      expect(
        await npmNextVersion({name: 'some-package', version: '1.2.3', packageDirectory}),
      ).to.equal('1.2.4')
    } finally {
      await close().catch(console.error)
    }
  })
})
