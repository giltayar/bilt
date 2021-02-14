import {inspect} from 'util'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'

import {calculateBuildOrder, build} from '../../src/build.js'

inspect.defaultOptions.depth = 1000

describe('build (unit)', function () {
  const ePackage = createPackageInfo({
    directory: 'edir',
    name: 'epackage',
    dependencies: [],
  })
  const fPackage = createPackageInfo({
    directory: 'fdir',
    name: 'fpackage',
    dependencies: [],
  })
  const cPackage = createPackageInfo({
    directory: 'cdir',
    name: 'cpackage',
    dependencies: [ePackage],
  })
  const dPackage = createPackageInfo({
    directory: 'ddir',
    name: 'dpackage',
    dependencies: [cPackage, ePackage],
  })
  const bPackage = createPackageInfo({
    directory: 'packages/bdir',
    name: 'bpackage',
    dependencies: [dPackage],
  })
  const aPackage = createPackageInfo({
    directory: 'adir',
    name: 'apackage',
    dependencies: [bPackage, cPackage],
  })
  const packageInfos = {
    [aPackage.directory]: aPackage,
    [bPackage.directory]: bPackage,
    [cPackage.directory]: cPackage,
    [dPackage.directory]: dPackage,
    [ePackage.directory]: ePackage,
    [fPackage.directory]: fPackage,
  }

  it('should build in the correct order', async () => {
    const buildOrder = calculateBuildOrder({packageInfos})

    /**@type {import('@bilt/types').RelativeDirectoryPath[]} */
    const packagesBuilt = []

    /**
     * @param {{packageInfo: import('@bilt/types').PackageInfo}} options
     * @returns {Promise<import('../../src/types.js').BuildPackageSuccessResult>}
     */
    async function buildPackageFunc({packageInfo}) {
      expect(packageInfo).to.eql(packageInfos[packageInfo.directory])

      packagesBuilt.push(packageInfo.directory)

      return 'success'
    }

    for await (const buildResult of build(packageInfos, buildOrder, buildPackageFunc)) {
      expect(buildResult).to.eql({
        package: {directory: packagesBuilt[packagesBuilt.length - 1]},
        buildResult: 'success',
      })
    }

    expect(packagesBuilt).to.eql(['edir', 'cdir', 'ddir', 'packages/bdir', 'adir', 'fdir'])
  })

  it('should build in the correct order even if dependencies includes a package not in packageInfos', async () => {
    const cPackage = createPackageInfo({
      directory: 'packages/cdir',
      name: 'cpackage',
      dependencies: [],
    })
    const bPackage = createPackageInfo({
      directory: 'packages/bdir',
      name: 'bpackage',
      dependencies: [cPackage],
    })
    const aPackage = createPackageInfo({
      directory: 'adir',
      name: 'apackage',
      dependencies: [bPackage],
    })
    const packageInfos = {
      [aPackage.directory]: aPackage,
      [bPackage.directory]: bPackage,
    }

    const buildOrder = calculateBuildOrder({packageInfos})
    const packagesBuilt = /**@type {import('@bilt/types').RelativeDirectoryPath[]}*/ ([])

    /**
     * @param {{packageInfo: import('@bilt/types').PackageInfo}} options
     * @returns {Promise<import('../../src/types.js').BuildPackageSuccessResult>}
     */
    async function buildPackageFunc({packageInfo}) {
      expect(packageInfo).to.eql(packageInfos[packageInfo.directory])

      packagesBuilt.push(packageInfo.directory)

      return 'success'
    }

    for await (const buildResult of build(packageInfos, buildOrder, buildPackageFunc)) {
      expect(buildResult).to.eql({
        package: {directory: packagesBuilt[packagesBuilt.length - 1]},
        buildResult: 'success',
      })
    }

    expect(packagesBuilt).to.eql(['packages/bdir', 'adir'])
  })

  it('should fail to build correctly', async () => {
    const buildOrder = calculateBuildOrder({packageInfos})

    const packagesBuilt = /**@type {import('@bilt/types').RelativeDirectoryPath[]}*/ ([])

    /**
     * @param {{packageInfo: import('@bilt/types').PackageInfo}} options
     * @returns {Promise<import('../../src/types.js').BuildPackageSuccessResult>}
     */
    async function buildPackageFunc({packageInfo}) {
      packagesBuilt.push(packageInfo.directory)

      return packageInfo.name === 'cpackage' ? 'failure' : 'success'
    }

    let countFailures = 0
    let countSuccesses = 0
    let countNotBuilt = 0
    for await (const buildResult of build(packageInfos, buildOrder, buildPackageFunc)) {
      const shouldBeSuccesful = ['edir', 'fdir'].includes(buildResult.package.directory)
      const shouldFail = ['cdir'].includes(buildResult.package.directory)

      if (buildResult.buildResult === 'success') {
        countSuccesses++
      } else if (buildResult.buildResult === 'failure') {
        countFailures++
      } else {
        countNotBuilt++
      }
      expect(buildResult.buildResult).to.eql(
        shouldBeSuccesful ? 'success' : shouldFail ? 'failure' : 'not-built',
      )
    }

    expect(packagesBuilt).to.eql(['edir', 'cdir', 'fdir'])
    expect(countSuccesses).to.eql(2)
    expect(countFailures).to.eql(1)
    expect(countNotBuilt).to.eql(3)
  })
})

/**
 * @param {{
 *  directory: string
 *  name: string
 *  dependencies: import('@bilt/types').Package[]
 * }} pi
 * @returns {import('@bilt/types').PackageInfo}
 */
function createPackageInfo(pi) {
  return {
    directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ (pi.directory),
    name: pi.name,
    dependencies: pi.dependencies,
  }
}
