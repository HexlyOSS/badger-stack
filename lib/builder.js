const DBO = require('./data/dbo')
const { System } = require('@hexly/systemjs')

const build = async settings => {
  const system = new System()

  // conditionally?
  DBO.hook(system)

  system.scan(1, 'example').scan(3, 'domain', 'fn')

  await system.init()

  return { app: system }
}

const Builder = () => {
  const settings = {}
  return { build: () => build(settings) }
}

module.exports = {
  Builder
}
