import {describe, it} from 'mocha'
import {expect} from 'chai'
import {RelativeDirectoryPath} from '@bilt/types'

import {
  calculatePackagesToBuild,
  PackageInfoWithBuildTime,
  PackageInfosWithBuildTime,
} from '../../src/packages-to-build'

describe('calculatePackagesToBuild (unit)', function () {
  const ePackage: PackageInfoWithBuildTime = {
    directory: 'edir' as RelativeDirectoryPath,
    name: 'epackage',
    dependencies: [],
    lastBuildTime: undefined,
  }
  const dPackage: PackageInfoWithBuildTime = {
    directory: 'ddir' as RelativeDirectoryPath,
    name: 'dpackage',
    dependencies: [ePackage],
    lastBuildTime: undefined,
  }
  const bPackage: PackageInfoWithBuildTime = {
    directory: 'packages/bdir' as RelativeDirectoryPath,
    name: 'bpackage',
    dependencies: [dPackage],
    lastBuildTime: undefined,
  }
  const cPackage: PackageInfoWithBuildTime = {
    directory: 'cdir' as RelativeDirectoryPath,
    name: 'cpackage',
    dependencies: [dPackage],
    lastBuildTime: undefined,
  }
  const aPackage: PackageInfoWithBuildTime = {
    directory: 'adir' as RelativeDirectoryPath,
    name: 'apackage',
    dependencies: [bPackage, cPackage],
    lastBuildTime: undefined,
  }
  const packageInfosAllDirty: PackageInfosWithBuildTime = {
    [aPackage.directory as string]: aPackage,
    [bPackage.directory as string]: bPackage,
    [cPackage.directory as string]: cPackage,
    [dPackage.directory as string]: dPackage,
    [ePackage.directory as string]: ePackage,
  }

  const gPackage: PackageInfoWithBuildTime = {
    directory: 'gdir' as RelativeDirectoryPath,
    name: 'gpackage',
    dependencies: [],
    lastBuildTime: undefined,
  }
  const fPackage: PackageInfoWithBuildTime = {
    directory: 'fdir' as RelativeDirectoryPath,
    name: 'fpackage',
    dependencies: [gPackage],
    lastBuildTime: undefined,
  }

  function build(pkg: PackageInfoWithBuildTime, lastBuildTime: number): PackageInfoWithBuildTime {
    return {...pkg, lastBuildTime}
  }

  describe('all dirty packages', () => {
    it('should support edgeless packages', () => {
      const twoPackagesWithNoDependencies = {
        [ePackage.directory as string]: ePackage,
        [gPackage.directory as string]: gPackage,
      }
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: twoPackagesWithNoDependencies,
        buildUpTo: [ePackage, gPackage],
        basePackagesToBuild: [ePackage, gPackage],
      })

      expect(packagesToBuild).to.eql({packageInfosWithBuildTime: twoPackagesWithNoDependencies})
    })
    it('if buildUpTo is same as basePackages, only base pacakges are build', () => {
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: packageInfosAllDirty,
        buildUpTo: [dPackage, ePackage],
        basePackagesToBuild: [dPackage, ePackage],
      })

      expect(packagesToBuild).to.eql({
        packageInfosWithBuildTime: {
          [dPackage.directory as string]: dPackage,
          [ePackage.directory as string]: ePackage,
        },
      })
    })

    it('if package with no dependents is asked to be built, that is the only package that will be built', () => {
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: packageInfosAllDirty,
        buildUpTo: [aPackage],
        basePackagesToBuild: [aPackage],
      })

      expect(packagesToBuild).to.eql({
        packageInfosWithBuildTime: {[aPackage.directory as string]: aPackage},
      })
    })

    it('if a low package asked to be built, with an upTo that points to it, all the chain between them will be built', () => {
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: packageInfosAllDirty,
        buildUpTo: [aPackage],
        basePackagesToBuild: [ePackage],
      })

      expect(packagesToBuild).to.eql({packageInfosWithBuildTime: packageInfosAllDirty})
    })

    it('if basePackages include packages that do not "lead" to buildUpTo packages, they will not be built', () => {
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: {
          ...packageInfosAllDirty,
          [gPackage.directory as string]: gPackage,
          [fPackage.directory as string]: fPackage,
        },
        buildUpTo: [aPackage],
        basePackagesToBuild: [ePackage, gPackage],
      })

      expect(packagesToBuild).to.eql({packageInfosWithBuildTime: packageInfosAllDirty})
    })

    it('if a medium package asked to be built, with an upTo that points to it, all the chain between them will be built', () => {
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: packageInfosAllDirty,
        buildUpTo: [aPackage],
        basePackagesToBuild: [dPackage],
      })

      expect(packagesToBuild).to.eql({
        packageInfosWithBuildTime: {
          [aPackage.directory as string]: aPackage,
          [cPackage.directory as string]: cPackage,
          [bPackage.directory as string]: bPackage,
          [dPackage.directory as string]: dPackage,
        },
      })
    })

    it('if two base packages generate the same package, it wont appear twice', () => {
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: packageInfosAllDirty,
        buildUpTo: [aPackage],
        basePackagesToBuild: [cPackage, bPackage],
      })

      expect(packagesToBuild).to.eql({
        packageInfosWithBuildTime: {
          [aPackage.directory as string]: aPackage,
          [cPackage.directory as string]: cPackage,
          [bPackage.directory as string]: bPackage,
        },
      })
    })

    it('should support two buildUptos that are medium', () => {
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: packageInfosAllDirty,
        buildUpTo: [cPackage, bPackage],
        basePackagesToBuild: [ePackage],
      })

      expect(packagesToBuild).to.eql({
        packageInfosWithBuildTime: {
          [ePackage.directory as string]: ePackage,
          [dPackage.directory as string]: dPackage,
          [cPackage.directory as string]: cPackage,
          [bPackage.directory as string]: bPackage,
        },
      })
    })
  })

  describe('with build times', () => {
    it('should not build anything if all packages have the same build time', async () => {
      const packageInfos: PackageInfosWithBuildTime = {
        [aPackage.directory as string]: build(aPackage, 1),
        [bPackage.directory as string]: build(bPackage, 1),
        [cPackage.directory as string]: build(cPackage, 1),
        [dPackage.directory as string]: build(dPackage, 1),
        [ePackage.directory as string]: build(ePackage, 1),
      }

      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [aPackage, bPackage, cPackage, dPackage, ePackage],
          buildUpTo: [aPackage, bPackage, cPackage, dPackage, ePackage],
        }),
      ).to.eql({packageInfosWithBuildTime: {}})
    })

    it('should build up when mid level package is dirty', async () => {
      const packageInfos: PackageInfosWithBuildTime = {
        [aPackage.directory as string]: build(aPackage, 1),
        [bPackage.directory as string]: build(bPackage, 1),
        [cPackage.directory as string]: cPackage,
        [dPackage.directory as string]: build(dPackage, 1),
        [ePackage.directory as string]: build(ePackage, 1),
      }

      const expectedResult = {
        [aPackage.directory as string]: build(aPackage, 1),
        [cPackage.directory as string]: cPackage,
      }
      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [aPackage, bPackage, cPackage, dPackage, ePackage],
          buildUpTo: [aPackage, bPackage, cPackage, dPackage, ePackage],
        }),
      ).to.eql({packageInfosWithBuildTime: expectedResult})

      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [aPackage, bPackage, cPackage, dPackage, ePackage],
          buildUpTo: [aPackage],
        }),
      ).to.eql({packageInfosWithBuildTime: expectedResult})

      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [ePackage],
          buildUpTo: [aPackage],
        }),
      ).to.eql({packageInfosWithBuildTime: expectedResult})
    })

    it('should build everything when low package is dirty', async () => {
      const packageInfos: PackageInfosWithBuildTime = {
        [aPackage.directory as string]: build(aPackage, 1),
        [bPackage.directory as string]: build(bPackage, 1),
        [cPackage.directory as string]: build(bPackage, 1),
        [dPackage.directory as string]: build(dPackage, 1),
        [ePackage.directory as string]: ePackage,
      }

      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [aPackage, bPackage, cPackage, dPackage, ePackage],
          buildUpTo: [aPackage, bPackage, cPackage, dPackage, ePackage],
        }),
      ).to.eql({packageInfosWithBuildTime: packageInfos})

      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [aPackage, bPackage, cPackage, dPackage, ePackage],
          buildUpTo: [aPackage],
        }),
      ).to.eql({packageInfosWithBuildTime: packageInfos})

      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [ePackage],
          buildUpTo: [aPackage],
        }),
      ).to.eql({packageInfosWithBuildTime: packageInfos})
    })

    it('should build up when mid level package is newer', async () => {
      const packageInfos: PackageInfosWithBuildTime = {
        [aPackage.directory as string]: build(aPackage, 1),
        [bPackage.directory as string]: build(bPackage, 1),
        [cPackage.directory as string]: build(cPackage, 2),
        [dPackage.directory as string]: build(dPackage, 1),
        [ePackage.directory as string]: build(ePackage, 1),
      }

      const expectedResult = {
        [aPackage.directory as string]: build(aPackage, 1),
      }
      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [aPackage, bPackage, cPackage, dPackage, ePackage],
          buildUpTo: [aPackage, bPackage, cPackage, dPackage, ePackage],
        }),
      ).to.eql({packageInfosWithBuildTime: expectedResult})

      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [aPackage, bPackage, cPackage, dPackage, ePackage],
          buildUpTo: [aPackage],
        }),
      ).to.eql({packageInfosWithBuildTime: expectedResult})

      expect(
        calculatePackagesToBuild({
          packageInfos,
          basePackagesToBuild: [bPackage, cPackage],
          buildUpTo: [aPackage],
        }),
      ).to.eql({packageInfosWithBuildTime: expectedResult})
    })

    it('should build separate trees as intended', () => {
      const packageInfosPlus = {
        [aPackage.directory as string]: build(aPackage, 1),
        [bPackage.directory as string]: build(bPackage, 1),
        [cPackage.directory as string]: cPackage,
        [dPackage.directory as string]: build(dPackage, 1),
        [ePackage.directory as string]: build(ePackage, 1),
        [gPackage.directory as string]: build(gPackage, 2),
        [fPackage.directory as string]: build(fPackage, 1),
      }

      const expectedResult = calculatePackagesToBuild({
        packageInfos: packageInfosPlus,
        buildUpTo: [aPackage, fPackage],
        basePackagesToBuild: [ePackage, gPackage],
      })

      expect(expectedResult).to.eql({
        packageInfosWithBuildTime: {
          [aPackage.directory as string]: build(aPackage, 1),
          [cPackage.directory as string]: cPackage,
          [fPackage.directory as string]: build(fPackage, 1),
        },
      })
    })
  })

  describe('warnings', () => {
    it('should warn when calculated packages is empty because none of the base packages builds up to the upto packages', () => {
      const twoPackagesWithNoDependencies = {
        [ePackage.directory as string]: ePackage,
        [gPackage.directory as string]: gPackage,
        [cPackage.directory as string]: cPackage,
      }
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: twoPackagesWithNoDependencies,
        buildUpTo: [ePackage, gPackage],
        basePackagesToBuild: [cPackage],
      })

      expect(packagesToBuild).to.eql({packageInfosWithBuildTime: {}, warnings: ['NO_LINKED_UPTO']})
    })
  })
})
