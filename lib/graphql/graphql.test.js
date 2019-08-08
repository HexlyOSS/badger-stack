const { ApolloServer, gql } = require('apollo-server-lambda')
const { buildFederatedSchema } = require('@apollo/federation')

test('does it build', () => {
  const typeDefs = gql`
    type Query {
      me: User
    }

    type User @key(fields: "id") {
      id: ID!
      username: String
    }
  `

  const resolvers = {
    Query: {
      me() {
        return { id: '1', username: '@ava' }
      }
    },
    User: {
      __resolveReference(user, { fetchUserById }) {
        return { id: 'Hello' }
      }
    }
  }

  const federated = buildFederatedSchema([{ typeDefs, resolvers }])
  console.log(federated)
})
