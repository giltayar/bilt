'use strict'
import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import {calculateNextVersion} from '../../src/calculate-next-version.js'

const publishedVersionsToTest = ['1.1.1', '1.1.2', '5.1.3', '5.4.0', '5.3.2', '5.4.1', '5.4.3']

describe('calculateNextVersion (unit)', function () {
  describe('calculateNextVersion', function () {
    it("should return a patch version increment when it's part of the latest 'branch'", function () {
      expect(calculateNextVersion('5.4.1', publishedVersionsToTest)).to.equal('5.4.4')
    })

    it("should return a patch version increment when it's part of a previous 'branch'", function () {
      expect(calculateNextVersion('1.1.1', publishedVersionsToTest)).to.equal('1.1.3')
    })

    it("should return itself when it's the largest version of the latest 'branch'", function () {
      expect(calculateNextVersion('5.4.5', publishedVersionsToTest)).to.equal('5.4.5')
    })

    it("should return itself when it's the largest version of the previous 'branch'", function () {
      expect(calculateNextVersion('1.1.4', publishedVersionsToTest)).to.equal('1.1.4')
    })

    it("should return itself when it's the only version of a 'branch'", function () {
      expect(calculateNextVersion('2.0.4', publishedVersionsToTest)).to.equal('2.0.4')
    })

    it("should return itself when it's the only version of the previous 'branch'", function () {
      expect(calculateNextVersion('2.0.4', publishedVersionsToTest)).to.equal('2.0.4')
    })

    it("should return a patch version increment when it's the same as the latest version of the latest 'branch'", function () {
      expect(calculateNextVersion('5.4.3', publishedVersionsToTest)).to.equal('5.4.4')
    })

    it("should return a patch version increment when it's the same as the latest version of the previous 'branch'", function () {
      expect(calculateNextVersion('1.1.2', publishedVersionsToTest)).to.equal('1.1.3')
    })

    it('should return itself when no published versions', function () {
      expect(calculateNextVersion('1.1.3', [])).to.equal('1.1.3')
    })
  })
})
