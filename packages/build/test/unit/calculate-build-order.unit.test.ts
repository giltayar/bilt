import {inspect} from 'util'
import {describe, it} from 'mocha'
import {expect} from 'chai'
import {PackageInfo, PackageInfos, RelativeDirectoryPath} from '@bilt/types'

import {calculateBuildOrder, Build} from '../../src/build'

inspect.defaultOptions.depth = 1000

describe('calculateBuildOrder (unit)', function () {
  const ePackage: PackageInfo = {
    directory: 'edir' as RelativeDirectoryPath,
    name: 'epackage',
    dependencies: [],
  }
  const fPackage: PackageInfo = {
    directory: 'fdir' as RelativeDirectoryPath,
    name: 'fpackage',
    dependencies: [],
  }
  const cPackage: PackageInfo = {
    directory: 'cdir' as RelativeDirectoryPath,
    name: 'cpackage',
    dependencies: [ePackage],
  }
  const dPackage: PackageInfo = {
    directory: 'ddir' as RelativeDirectoryPath,
    name: 'dpackage',
    dependencies: [cPackage, ePackage],
  }
  const bPackage: PackageInfo = {
    directory: 'packages/bdir' as RelativeDirectoryPath,
    name: 'bpackage',
    dependencies: [dPackage],
  }
  const aPackage: PackageInfo = {
    directory: 'adir' as RelativeDirectoryPath,
    name: 'apackage',
    dependencies: [bPackage, cPackage],
  }
  const packageInfos: PackageInfos = {
    [aPackage.directory]: aPackage,
    [bPackage.directory]: bPackage,
    [cPackage.directory]: cPackage,
    [dPackage.directory]: dPackage,
    [ePackage.directory]: ePackage,
    [fPackage.directory]: fPackage,
  }

  it('should create the correct build order for the above packageInfos', () => {
    const aBuild: Build = {packageToBuild: aPackage, buildOrderAfter: []}
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
    ] as ReturnType<typeof calculateBuildOrder>)
  })
})
