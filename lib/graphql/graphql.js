// const { graphql } = require('graphql')

// we may need the calling app to pass these in, due to
// typing issues with the Query in `graphql` and npm loaders
// tl;dr - if weird shiz happens, talk to dtw
const _ = require('lodash')
const Config = require('config')
const graphqlTools = require('graphql-tools')
const graphqlMiddleware = require('graphql-middleware')
const apolloServerLambda = require('apollo-server-lambda')
const { buildFederatedSchema } = require('@apollo/federation')
const { ApolloGateway } = require('@apollo/gateway')

// if we do have to inject them, these have to move accordingly
const { ApolloServer, gql } = apolloServerLambda
const { makeExecutableSchema } = graphqlTools
const { applyMiddlewareToDeclaredResolvers } = graphqlMiddleware

const levels = require('../levels')
const scalars = require('./scalars')

const SYSTEM_KEY = 'apollo'
const PREFIX_JS = 'schema'
const hook = system => {
  system.graphql = system.graphql || {}
  let resolve, reject
  const promise = new Promise((resolve2, reject2) => {
    resolve = resolve2
    reject = reject2
  })

  system.scan(levels.SYSTEM, SYSTEM_KEY, PREFIX_JS)
  system.graphql.createHandler = createWrapperHandler(promise)

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

    try {
      system.graphql.typeDefs = gql(typeDefs)
      system.graphql.resolvers = _.merge.apply(_, resolvers)
      system.graphql.schemaDirectives = schemaDirectives
      const schema = buildFederatedSchema([
        {
          typeDefs: system.graphql.typeDefs,
          resolvers: system.graphql.resolvers,
          schemaDirectives: system.graphql.schemaDirectives
        }
      ])
      system.graphqlschema = schema

      resolve(schema)
    } catch (err) {
      reject(err)
    }
  })
}

function createWrapperHandler(promise) {
  return ({ createContext, gateway }) => {
    const wrapper = (event, context, callback) => {
      promise
        .then(schema => {
          const handler = createLambdaHandler(
            { schema, gateway },
            createContext
          )
          return handler(event, context, callback)
        })
        .catch(err => {
          console.log('errorrrr', err)
          callback(err)
        })
    }
    Object.assign(wrapper, {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise)
    })
    return wrapper
  }
}

const createLambdaHandler = ({ schema, gateway }, createContext) => {
  const schemaConfig = {
    context: createContext,
    formatError: err => {
      const ex = _.get(err, 'extensions.exception', '<no exception provided>')
      console.log('[badger.graphql] GraphQL err', ex)
      delete err.extensions
      return err
    }
  }

  if (gateway) {
    schemaConfig.subscriptions = false
    schemaConfig.gateway = new ApolloGateway({
      ...gateway
    })
  } else {
    schemaConfig.schema = schema
    const middlewares = []
    middlewares.forEach(mw =>
      applyMiddlewareToDeclaredResolvers(schema, {
        Query: mw,
        Mutation: mw
      })
    )
  }
  // if (process.env.SKIP_GRAPHQL_MIDDLEWARE === 'true') {
  //   schemaConfig.middlewares = []
  // }

  if (process.env.ENGINE_API_KEY) {
    schemaConfig.engine = {
      apiKey: process.env.ENGINE_API_KEY
    }
  }

  const server = new ApolloServer(schemaConfig)
  const handler = server.createHandler()
  handler.__refreshed = new Date()
  return handler
}

module.exports = {
  hook
}
