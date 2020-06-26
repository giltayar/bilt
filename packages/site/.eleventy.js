'use strict'
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("public/resources");
  return {
    markdownTemplateEngine: 'ejs',
    htmlTemplateEngine: 'ejs',
    dir: {
      input: "public",
      output: "dist"
    }
  }
}

