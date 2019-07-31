const _ = require('lodash')
const Config = require('config')

const DBO = require('./data/dbo')
const PG = require('./data/pg')
const Middy = require('./lambda/middleware')
const GraphQL = require('./graphql/graphql')
const { System } = require('@hexly/systemjs')

const build = (settings = {}) => {
  const system = new System()
  system.settings = settings

  // conditionally?

  if (_.get(Config, 'badger.pg.disabled', false)) {
    // log?
  } else {
    PG.hook(system)
    DBO.hook(system)
  }
  Middy.hook(system)
  GraphQL.hook(system)

  return { app: system }
}

const Builder = () => {
  const settings = {}
  return { build: () => build(settings) }
}

module.exports = {
  Builder
}
