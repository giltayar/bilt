'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')
const versionCalc = require('../../src/version-calculations')

const publishedVersionsToTest = ['1.1.1', '1.1.2', '5.1.3', '5.4.0', '5.3.2', '5.4.1', '5.4.3']

describe('version-calculations', function() {
  describe('#calculateNextVersionPackage', function() {
    it("should return a patch version increment when it's part of the latest 'branch'", function() {
      expect(versionCalc.calculateNextVersionPackage('5.4.1', publishedVersionsToTest)).to.equal(
        '5.4.4',
      )
    })

    it("should return a patch version increment when it's part of a previous 'branch'", function() {
      expect(versionCalc.calculateNextVersionPackage('1.1.1', publishedVersionsToTest)).to.equal(
        '1.1.3',
      )
    })

    it("should return itself when it's the largest version of the latest 'branch'", function() {
      expect(versionCalc.calculateNextVersionPackage('5.4.5', publishedVersionsToTest)).to.equal(
        '5.4.5',
      )
    })

    it("should return itself when it's the largest version of the previous 'branch'", function() {
      expect(versionCalc.calculateNextVersionPackage('1.1.4', publishedVersionsToTest)).to.equal(
        '1.1.4',
      )
    })

    it("should return itself when it's the only version of a 'branch'", function() {
      expect(versionCalc.calculateNextVersionPackage('2.0.4', publishedVersionsToTest)).to.equal(
        '2.0.4',
      )
    })

    it("should return itself when it's the only version of the previous 'branch'", function() {
      expect(versionCalc.calculateNextVersionPackage('2.0.4', publishedVersionsToTest)).to.equal(
        '2.0.4',
      )
    })

    it("should return a patch version increment when it's the same as the latest version of the latest 'branch'", function() {
      expect(versionCalc.calculateNextVersionPackage('5.4.3', publishedVersionsToTest)).to.equal(
        '5.4.4',
      )
    })

    it("should return a patch version increment when it's the same as the latest version of the previous 'branch'", function() {
      expect(versionCalc.calculateNextVersionPackage('1.1.2', publishedVersionsToTest)).to.equal(
        '1.1.3',
      )
    })

    it('should return itself when no published versions', function() {
      expect(versionCalc.calculateNextVersionPackage('1.1.3', [])).to.equal('1.1.3')
    })
  })

  describe('#calculateLatestPublishedVersion', () => {
    it('#calculateCurrentPublished ', () => {
      expect(versionCalc.calculateCurrentPublished('5.4.1', publishedVersionsToTest)).to.equal(
        '5.4.3',
      )
      expect(versionCalc.calculateCurrentPublished('1.1.1', publishedVersionsToTest)).to.equal(
        '1.1.2',
      )
      expect(versionCalc.calculateCurrentPublished('5.4.3', publishedVersionsToTest)).to.equal(
        '5.4.3',
      )
      expect(versionCalc.calculateCurrentPublished('1.1.2', publishedVersionsToTest)).to.equal(
        '1.1.2',
      )
    })

    it('should return false when current package version is not published', () => {
      expect(versionCalc.calculateCurrentPublished('5.4.5', publishedVersionsToTest)).to.be.false
      expect(versionCalc.calculateCurrentPublished('1.1.4', publishedVersionsToTest)).to.be.false
      expect(versionCalc.calculateCurrentPublished('2.0.4', publishedVersionsToTest)).to.be.false
      expect(versionCalc.calculateCurrentPublished('2.0.4', publishedVersionsToTest)).to.be.false
      expect(versionCalc.calculateCurrentPublished('1.1.3', [])).to.be.false
    })
  })
})
