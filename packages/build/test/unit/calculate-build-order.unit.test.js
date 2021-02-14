import {inspect} from 'util'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'

import {calculateBuildOrder} from '../../src/build.js'

inspect.defaultOptions.depth = 1000

describe('calculateBuildOrder (unit)', function () {
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

  it('should create the correct build order for the above packageInfos', () => {
    const aBuild = {packageToBuild: aPackage, buildOrderAfter: []}
    const dBuild = {
      packageToBuild: dPackage,
      buildOrderAfter: [
        {
          packageToBuild: bPackage,
          buildOrderAfter: [aBuild],
        },
      ],
    }

    const result = calculateBuildOrder({packageInfos})

    expect(result).to.eql([
      {
        packageToBuild: ePackage,
        buildOrderAfter: [
          {
            packageToBuild: cPackage,
            buildOrderAfter: [aBuild, dBuild],
          },
          dBuild,
        ],
      },
      {
        packageToBuild: fPackage,
        buildOrderAfter: [],
      },
    ])
  })

  it('should calculate correct build order even if dependencies includes a package not in packageInfos', () => {
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

    const result = calculateBuildOrder({packageInfos})

    expect(result).to.eql([
      {
        packageToBuild: bPackage,
        buildOrderAfter: [
          {
            packageToBuild: aPackage,
            buildOrderAfter: [],
          },
        ],
      },
    ])
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
