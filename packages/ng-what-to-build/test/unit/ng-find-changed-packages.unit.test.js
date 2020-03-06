import {describe, it} from 'mocha'
import {expect} from 'chai'

import {findChangedPackages} from '../../src/ng-what-to-build'

describe('findChangedPackages (unit)', function() {
  const aPackage = {directory: 'adir'}
  const bPackage = {directory: 'packages/bdir'}
  const cPackage = {directory: 'cdir'}

  it('find packages that were changed from one file that was changed in them in a subdir', () => {
    const changedPackages = findChangedPackages({
      changedFiles: ['adir/subdir/foo.txt', 'packages/bdir/subdir/zoo.txt'],
      packages: [aPackage, bPackage, cPackage],
    })

    expect(changedPackages).to.have.deep.members([aPackage, bPackage])
  })

  it('find packages that were changed from one file that was changed in them', () => {
    const changedPackages = findChangedPackages({
      changedFiles: ['adir/subdir/foo.txt', 'packages/bdir/zoo.txt'],
      packages: [aPackage, bPackage, cPackage],
    })

    expect(changedPackages).to.have.deep.members([aPackage, bPackage])
  })

  it('find packages that were changed from multiple file that was changed in them', () => {
    const changedPackages = findChangedPackages({
      changedFiles: ['adir/subdir/foo.txt', 'cdir/zoo.txt', 'cdir/lalala/azoom.txt'],
      packages: [aPackage, bPackage, cPackage],
    })

    expect(changedPackages).to.have.deep.members([aPackage, cPackage])
  })

  it('a file that is not in any pacakge should not affect anything', () => {
    const changedPackages = findChangedPackages({
      changedFiles: ['xdir', 'xdir/b.txt', 'adir/subdir/foo.txt'],
      packages: [aPackage, bPackage, cPackage],
    })

    expect(changedPackages).to.have.deep.members([aPackage])
  })

  it('a file that is not is in a prefix of another packageshould not affect anything', () => {
    const changedPackages = findChangedPackages({
      changedFiles: ['adirmoremoremore/foo.txt', 'packages/bdir/subdir/foo.txt'],
      packages: [aPackage, bPackage, cPackage],
    })

    expect(changedPackages).to.have.deep.members([bPackage])
  })
})
