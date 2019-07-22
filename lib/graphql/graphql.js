// const { graphql } = require('graphql')

// we may need the calling app to pass these in, due to
// typing issues with the Query in `graphql` and npm loaders
// tl;dr - if weird shiz happens, talk to dtw
const _ = require('lodash')
const graphqlTools = require('graphql-tools')
const graphqlMiddleware = require('graphql-middleware')
const apolloServerLambda = require('apollo-server-lambda')

// if we do have to inject them, these have to move accordingly
const { ApolloServer } = apolloServerLambda
const { makeExecutableSchema } = graphqlTools
const { applyMiddlewareToDeclaredResolvers } = graphqlMiddleware

const levels = require('../levels')
const scalars = require('./scalars')

const SYSTEM_KEY = 'apollo'
const PREFIX_JS = 'schema'
const hook = system => {
  system.scan(levels.SYSTEM, SYSTEM_KEY, PREFIX_JS)
  system.graphql = system.graphql || {}

  let res, rej
  const promise = new Promise((resolve, reject) => {
    res = resolve
    rej = reject
  })

  system.graphql.createHandler = createContext => (
    event,
    context,
    callback
  ) => {
    promise.then(schema => {
      const handler = createHandler(schema, createContext)
      handler(event, context, callback)
    })
  }

  system.on(`resolution:resolved:${SYSTEM_KEY}`, ({ resolved }) => {
    let typeDefs = /* GraphQL */ `
      ${scalars.typeDefs}
    `
    const resolvers = [scalars.resolvers]
    const schemaDirectives = []

    Object.keys(resolved).forEach(name => {
      const schema = resolved[name]
      if (typeof schema.typeDefs === 'undefined') {
        const msg = `[badger.graphql] Failed on schema ${name}: no typeDef`
        console.warn(msg, { name, schema })
        throw new Error(msg)
      }
      typeDefs += `${schema.typeDefs}\n\n`
      schema.resolvers && resolvers.push(schema.resolvers)
      schema.schemaDirectives && schemaDirectives.push(schema.schemaDirectives)
    })

    const schema = {
      schema: makeExecutableSchema({
        typeDefs,
        resolvers,
        schemaDirectives
      })
    }

    system.graphql.typeDefs = typeDefs
    system.graphql.resolvers = resolvers
    system.graphql.schemaDirectives = schemaDirectives
    system.graphqlschema = schema

    res(schema)
  })
}

const createHandler = ({ schema }, createContext) => {
  const schemaConfig = {
    schema,
    context: createContext,
    formatError: err => {
      const ex = _.get(err, 'extensions.exception', '<no exception provided>')
      console.log('[badger.graphql] GraphQL err', ex)
      delete err.extensions
      return err
    }
  }
  // if (process.env.SKIP_GRAPHQL_MIDDLEWARE === 'true') {
  //   schemaConfig.middlewares = []
  // }

  if (process.env.ENGINE_API_KEY) {
    schemaConfig.engine = {
      apiKey: process.env.ENGINE_API_KEY
    }
  }

  const middlewares = []
  middlewares.forEach(mw =>
    applyMiddlewareToDeclaredResolvers(schema, {
      Query: mw,
      Mutation: mw
    })
  )

  const server = new ApolloServer(schemaConfig)
  const handler = server.createHandler()
  handler.__refreshed = new Date()
  return handler
}

module.exports = {
  hook
}
