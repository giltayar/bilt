import {describe, it} from 'mocha'
import {expect} from 'chai'
import {RelativeDirectoryPath} from '@bilt/types'

import {
  calculatePackagesToBuild,
  PackageInfoWithBuildTimes,
  PackageInfosWithBuildTimes,
} from '../../src/packages-to-build'

describe('calculatePackagesToBuild (unit)', function () {
  const ePackage: PackageInfoWithBuildTimes = {
    directory: 'edir' as RelativeDirectoryPath,
    name: 'epackage',
    dependencies: [],
    lastBuildTime: undefined,
  }
  const dPackage: PackageInfoWithBuildTimes = {
    directory: 'ddir' as RelativeDirectoryPath,
    name: 'dpackage',
    dependencies: [ePackage],
    lastBuildTime: undefined,
  }
  const bPackage: PackageInfoWithBuildTimes = {
    directory: 'packages/bdir' as RelativeDirectoryPath,
    name: 'bpackage',
    dependencies: [dPackage],
    lastBuildTime: undefined,
  }
  const cPackage: PackageInfoWithBuildTimes = {
    directory: 'cdir' as RelativeDirectoryPath,
    name: 'cpackage',
    dependencies: [dPackage],
    lastBuildTime: undefined,
  }
  const aPackage: PackageInfoWithBuildTimes = {
    directory: 'adir' as RelativeDirectoryPath,
    name: 'apackage',
    dependencies: [bPackage, cPackage],
    lastBuildTime: undefined,
  }
  const packageInfos: PackageInfosWithBuildTimes = {
    [aPackage.directory as string]: aPackage,
    [bPackage.directory as string]: bPackage,
    [cPackage.directory as string]: cPackage,
    [dPackage.directory as string]: dPackage,
    [ePackage.directory as string]: ePackage,
  }

  it('if buildUpTo is same as basePackages, only base pacakges are build', () => {
    const packagesToBuild = calculatePackagesToBuild({
      packageInfos,
      buildUpTo: [dPackage, ePackage],
      basePackagesToBuild: [dPackage, ePackage],
    })

    expect(packagesToBuild).to.eql({
      [dPackage.directory as string]: dPackage,
      [ePackage.directory as string]: ePackage,
    })
  })

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

  it('if basePackages include packages that do not "lead" to buildUpTo packages, they will not be built', () => {
    const gPackage: PackageInfoWithBuildTimes = {
      directory: 'gdir' as RelativeDirectoryPath,
      name: 'gpackage',
      dependencies: [],
      lastBuildTime: undefined,
    }
    const fPackage: PackageInfoWithBuildTimes = {
      directory: 'fdir' as RelativeDirectoryPath,
      name: 'fpackage',
      dependencies: [gPackage],
      lastBuildTime: undefined,
    }

    const packagesToBuild = calculatePackagesToBuild({
      packageInfos: {
        ...packageInfos,
        [gPackage.directory as string]: gPackage,
        [fPackage.directory as string]: fPackage,
      },
      buildUpTo: [aPackage],
      basePackagesToBuild: [ePackage, gPackage],
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
