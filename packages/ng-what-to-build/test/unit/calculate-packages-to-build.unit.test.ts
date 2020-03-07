import {describe, it} from 'mocha'
import {expect} from 'chai'
import {PackageInfo, PackageInfos} from '@bilt/ng-packages'

import {calculatePackagesToBuild} from '../../src/ng-what-to-build'

describe('calculatePackagesToBuild (unit)', function() {
  const ePackage: PackageInfo = {directory: 'edir', name: 'epackage', dependencies: []}
  const dPackage: PackageInfo = {directory: 'ddir', name: 'dpackage', dependencies: [ePackage]}
  const bPackage: PackageInfo = {
    directory: 'packages/bdir',
    name: 'bpackage',
    dependencies: [dPackage],
  }
  const cPackage: PackageInfo = {directory: 'cdir', name: 'cpackage', dependencies: [dPackage]}
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
  }

  it('if package with no dependents is asked to be built, that is the only package that will be built', () => {
    const packagesToBuild = calculatePackagesToBuild({
      packageInfos,
      buildUpTo: [aPackage],
      basePackagesToBuild: [aPackage],
    })

    expect(packagesToBuild).to.eql({[aPackage.directory as string]: aPackage})
  })

  it('if a low package asked to be built, with an upTo that points to it, all the chain between them will be built', () => {
    const packagesToBuild = calculatePackagesToBuild({
      packageInfos,
      buildUpTo: [aPackage],
      basePackagesToBuild: [ePackage],
    })

    expect(packagesToBuild).to.eql(packageInfos)
  })

  it('if a medium package asked to be built, with an upTo that points to it, all the chain between them will be built', () => {
    const packagesToBuild = calculatePackagesToBuild({
      packageInfos,
      buildUpTo: [aPackage],
      basePackagesToBuild: [dPackage],
    })

    expect(packagesToBuild).to.eql({
      [aPackage.directory as string]: aPackage,
      [cPackage.directory as string]: cPackage,
      [bPackage.directory as string]: bPackage,
      [dPackage.directory as string]: dPackage,
    })
  })

  it('if two base packages generate the same package, it wont appear twice', () => {
    const packagesToBuild = calculatePackagesToBuild({
      packageInfos,
      buildUpTo: [aPackage],
      basePackagesToBuild: [cPackage, bPackage],
    })

    expect(packagesToBuild).to.eql({
      [aPackage.directory as string]: aPackage,
      [cPackage.directory as string]: cPackage,
      [bPackage.directory as string]: bPackage,
    })
  })

  it('should support two buildUptos that are medium', () => {
    const packagesToBuild = calculatePackagesToBuild({
      packageInfos,
      buildUpTo: [cPackage, bPackage],
      basePackagesToBuild: [ePackage],
    })

    expect(packagesToBuild).to.eql({
      [ePackage.directory as string]: ePackage,
      [dPackage.directory as string]: dPackage,
      [cPackage.directory as string]: cPackage,
      [bPackage.directory as string]: bPackage,
    })
  })
})
