const { GraphQLDate, GraphQLDateTime } = require('graphql-iso-date')
const GraphQLJSON = require('graphql-type-json')

const typeDefs = /* GraphQL */ `
  scalar Date
  scalar DateTime
  scalar JSON

  input DateRangeInput {
    from: Date
    to: Date
  }

  type Query {
    _blank: Int
  }

  type Mutation {
    _blank: Int
  }

  enum SortDirection {
    ASC
    DESC
  }
`

const resolvers = {
  Date: GraphQLDate,
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,
  Query: {
    _blank: () => Promise.resolve(1)
  },
  Mutation: {
    _blank: () => Promise.resolve(1)
  }
}

module.exports = {
  typeDefs,
  resolvers
}
