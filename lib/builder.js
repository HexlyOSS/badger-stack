const DBO = require('./data/dbo')
const PG = require('./data/pg')
const { System } = require('@hexly/systemjs')

const build = async settings => {
  const system = new System()

  // conditionally?
  PG.hook(system)
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
