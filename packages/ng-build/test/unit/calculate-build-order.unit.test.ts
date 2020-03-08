import {inspect} from 'util'
import {describe, it} from 'mocha'
import {expect} from 'chai'
import {PackageInfo, PackageInfos} from '@bilt/ng-packages'

import {calculateBuildOrder, Build} from '../../src/ng-build'

inspect.defaultOptions.depth = 1000

describe('calculateBuildOrder (unit)', function() {
  const ePackage: PackageInfo = {directory: 'edir', name: 'epackage', dependencies: []}
  const fPackage: PackageInfo = {directory: 'fdir', name: 'fpackage', dependencies: []}
  const dPackage: PackageInfo = {directory: 'ddir', name: 'dpackage', dependencies: [ePackage]}
  const bPackage: PackageInfo = {
    directory: 'packages/bdir',
    name: 'bpackage',
    dependencies: [dPackage],
  }
  const cPackage: PackageInfo = {directory: 'cdir', name: 'cpackage', dependencies: [ePackage]}
  const aPackage: PackageInfo = {
    directory: 'adir',
    name: 'apackage',
    dependencies: [bPackage, cPackage],
  }
  const packageInfos: PackageInfos = {
    [aPackage.directory as string]: aPackage,
    [bPackage.directory as string]: bPackage,
    [cPackage.directory as string]: cPackage,
    [dPackage.directory as string]: dPackage,
    [ePackage.directory as string]: ePackage,
    [fPackage.directory as string]: fPackage,
  }

  it('should create the correct build order for the above packageInfos', () => {
    const aBuild: Build = {packageToBuild: aPackage, numberOfReferences: 2, buildOrderAfter: []}
    const result = calculateBuildOrder({packageInfos})

    expect(result).to.eql([
      {
        packageToBuild: ePackage,
        numberOfReferences: 1,
        buildOrderAfter: [
          {
            packageToBuild: cPackage,
            numberOfReferences: 1,
            buildOrderAfter: [aBuild],
          },
          {
            packageToBuild: dPackage,
            numberOfReferences: 1,
            buildOrderAfter: [
              {
                packageToBuild: bPackage,
                numberOfReferences: 1,
                buildOrderAfter: [aBuild],
              },
            ],
          },
        ],
      },
      {
        packageToBuild: fPackage,
        numberOfReferences: 1,
        buildOrderAfter: [],
      },
    ] as ReturnType<typeof calculateBuildOrder>)
  })
})
