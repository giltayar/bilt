import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'

import {calculatePackagesToBuild} from '../../src/packages-to-build.js'

describe('calculatePackagesToBuild (unit)', function () {
  const ePackage = createPackageInfoWithBuildTime({
    directory: 'edir',
    name: 'epackage',
    dependencies: [],
    lastBuildTime: undefined,
  })
  const dPackage = createPackageInfoWithBuildTime({
    directory: 'ddir',
    name: 'dpackage',
    dependencies: [ePackage],
    lastBuildTime: undefined,
  })
  const bPackage = createPackageInfoWithBuildTime({
    directory: 'packages/bdir',
    name: 'bpackage',
    dependencies: [dPackage],
    lastBuildTime: undefined,
  })
  const cPackage = createPackageInfoWithBuildTime({
    directory: 'cdir',
    name: 'cpackage',
    dependencies: [dPackage],
    lastBuildTime: undefined,
  })
  const aPackage = createPackageInfoWithBuildTime({
    directory: 'adir',
    name: 'apackage',
    dependencies: [bPackage, cPackage],
    lastBuildTime: undefined,
  })
  /**@type {import('../../src/types').PackageInfosWithBuildTime} */
  const packageInfosAllDirty = {
    [aPackage.directory]: aPackage,
    [bPackage.directory]: bPackage,
    [cPackage.directory]: cPackage,
    [dPackage.directory]: dPackage,
    [ePackage.directory]: ePackage,
  }

  const gPackage = createPackageInfoWithBuildTime({
    directory: 'gdir',
    name: 'gpackage',
    dependencies: [],
    lastBuildTime: undefined,
  })
  const fPackage = createPackageInfoWithBuildTime({
    directory: 'fdir',
    name: 'fpackage',
    dependencies: [gPackage],
    lastBuildTime: undefined,
  })

  /**
   * @param {import('../../src/types').PackageInfoWithBuildTime} pkg
   * @param {number} lastBuildTime
   * @returns {import('../../src/types').PackageInfoWithBuildTime}
   */
  function build(pkg, lastBuildTime) {
    return {...pkg, lastBuildTime}
  }

  describe('all dirty packages', () => {
    it('should support edgeless packages', () => {
      const twoPackagesWithNoDependencies = {
        [ePackage.directory]: ePackage,
        [gPackage.directory]: gPackage,
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
          [dPackage.directory]: dPackage,
          [ePackage.directory]: ePackage,
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
        packageInfosWithBuildTime: {[aPackage.directory]: aPackage},
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
          [gPackage.directory]: gPackage,
          [fPackage.directory]: fPackage,
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
          [aPackage.directory]: aPackage,
          [cPackage.directory]: cPackage,
          [bPackage.directory]: bPackage,
          [dPackage.directory]: dPackage,
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
          [aPackage.directory]: aPackage,
          [cPackage.directory]: cPackage,
          [bPackage.directory]: bPackage,
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
          [ePackage.directory]: ePackage,
          [dPackage.directory]: dPackage,
          [cPackage.directory]: cPackage,
          [bPackage.directory]: bPackage,
        },
      })
    })
  })

  describe('with build times', () => {
    it('should not build anything if all packages have the same build time', async () => {
      const packageInfos = {
        [aPackage.directory]: build(aPackage, 1),
        [bPackage.directory]: build(bPackage, 1),
        [cPackage.directory]: build(cPackage, 1),
        [dPackage.directory]: build(dPackage, 1),
        [ePackage.directory]: build(ePackage, 1),
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
      const packageInfos = {
        [aPackage.directory]: build(aPackage, 1),
        [bPackage.directory]: build(bPackage, 1),
        [cPackage.directory]: cPackage,
        [dPackage.directory]: build(dPackage, 1),
        [ePackage.directory]: build(ePackage, 1),
      }

      const expectedResult = {
        [aPackage.directory]: build(aPackage, 1),
        [cPackage.directory]: cPackage,
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
      const packageInfos = {
        [aPackage.directory]: build(aPackage, 1),
        [bPackage.directory]: build(bPackage, 1),
        [cPackage.directory]: build(bPackage, 1),
        [dPackage.directory]: build(dPackage, 1),
        [ePackage.directory]: ePackage,
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
      const packageInfos = {
        [aPackage.directory]: build(aPackage, 1),
        [bPackage.directory]: build(bPackage, 1),
        [cPackage.directory]: build(cPackage, 2),
        [dPackage.directory]: build(dPackage, 1),
        [ePackage.directory]: build(ePackage, 1),
      }

      const expectedResult = {
        [aPackage.directory]: build(aPackage, 1),
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
        [aPackage.directory]: build(aPackage, 1),
        [bPackage.directory]: build(bPackage, 1),
        [cPackage.directory]: cPackage,
        [dPackage.directory]: build(dPackage, 1),
        [ePackage.directory]: build(ePackage, 1),
        [gPackage.directory]: build(gPackage, 2),
        [fPackage.directory]: build(fPackage, 1),
      }

      const expectedResult = calculatePackagesToBuild({
        packageInfos: packageInfosPlus,
        buildUpTo: [aPackage, fPackage],
        basePackagesToBuild: [ePackage, gPackage],
      })

      expect(expectedResult).to.eql({
        packageInfosWithBuildTime: {
          [aPackage.directory]: build(aPackage, 1),
          [cPackage.directory]: cPackage,
          [fPackage.directory]: build(fPackage, 1),
        },
      })
    })
  })

  describe('warnings', () => {
    it('should warn when calculated packages is empty because none of the base packages builds up to the upto packages', () => {
      const twoPackagesWithNoDependencies = {
        [ePackage.directory]: ePackage,
        [gPackage.directory]: gPackage,
        [cPackage.directory]: cPackage,
      }
      const packagesToBuild = calculatePackagesToBuild({
        packageInfos: twoPackagesWithNoDependencies,
        buildUpTo: [ePackage, gPackage],
        basePackagesToBuild: [cPackage],
      })

      expect(packagesToBuild).to.eql({packageInfosWithBuildTime: {}, warnings: ['NO_LINKED_UPTO']})
    })
  })

  describe('circular dependencies', () => {
    it('should support circular dependencies', () => {
      const aPackage = createPackageInfoWithBuildTime({
        directory: 'adir',
        name: 'apackage',
        dependencies: [],
        lastBuildTime: undefined,
      })
      const bPackage = createPackageInfoWithBuildTime({
        directory: 'bdir',
        name: 'bpackage',
        dependencies: [],
        lastBuildTime: undefined,
      })
      const cPackage = createPackageInfoWithBuildTime({
        directory: 'cdir',
        name: 'cpackage',
        dependencies: [],
        lastBuildTime: undefined,
      })
      aPackage.dependencies.push(bPackage)
      aPackage.dependencies.push(cPackage)
      bPackage.dependencies.push(aPackage)
      bPackage.dependencies.push(cPackage)
      cPackage.dependencies.push(aPackage)

      const packageInfos = {
        [aPackage.directory]: aPackage,
        [bPackage.directory]: bPackage,
        [cPackage.directory]: cPackage,
      }

      const packagesToBuild = calculatePackagesToBuild({
        packageInfos,
        basePackagesToBuild: [cPackage],
        buildUpTo: [aPackage],
      })

      expect(
        packagesToBuild.packageInfosWithBuildTime['adir'].dependencies.map((d) => d.directory),
      ).to.eql(['bdir', 'cdir'])
      expect(
        packagesToBuild.packageInfosWithBuildTime['bdir'].dependencies.map((d) => d.directory),
      ).to.eql(['cdir'])
      expect(
        packagesToBuild.packageInfosWithBuildTime['cdir'].dependencies.map((d) => d.directory),
      ).to.eql([])
    })
  })
})

/**
 * @param {{
 *  directory: string
 *  name: string
 *  dependencies: import('../../src/types').PackageInfoWithBuildTime[]
 *  lastBuildTime: undefined
 * }} pi
 * @returns {import('../../src/types').PackageInfoWithBuildTime}
 */
function createPackageInfoWithBuildTime(pi) {
  return {
    directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ (pi.directory),
    name: pi.name,
    dependencies: pi.dependencies,
    lastBuildTime: pi.lastBuildTime,
  }
}
