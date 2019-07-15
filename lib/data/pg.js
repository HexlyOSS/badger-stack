const _ = require('lodash')
const Config = require('config')
const yesql = require('yesql').pg
const SafeSQL = require('pg-sql2')
const camelize = require('camelize')
const { Pool, types, Query } = require('pg')

const parseUrl = details => {
  const { user, password, host, port, db, args } = details
  const creds = `${user || ''}${password ? ':' + password : ''}`
  const dburl = `${host}${port ? ':' + port : ''}/${db}${args || ''}`
  const url = `postgres://${creds ? creds + '@' : ''}${dburl}`
  return url
}

const jwtClaimsQuery = claims => {
  const sqlArr = Object.keys(claims).map((prop, idx) => {
    const setting = prop == 'role' ? prop : 'jwt.claims.' + prop
    const value = SafeSQL.value(claims[prop])
    return SafeSQL.query`set_config(${SafeSQL.value(setting)}, ${value}, true)`
  })
  const sql = SafeSQL.compile(
    SafeSQL.query`select ${SafeSQL.join(sqlArr, ', ')}`
  )
  return sql
}

const connection = (pool, system) => async claims => {
  const client = await pool.connect()
  // map our JWT info to the PG current local scope
  if (claims) {
    await client.query('begin')
    await client.query(jwtClaimsQuery(claims))
  }
  return client
}

const DataConn = client => {
  const query = (sql, params) => client.query(yesql(sql)(params))
  const session = {
    begin: async () => {
      await client.query('begin')
    },
    commit: async () => {
      await client.query('commit')
    },
    rollback: async err => {
      await client.query('rollback')
      throw err
    }
  }

  const transaction = async callback => {
    try {
      const txConn = await system.pg.connection()
      const txClient = await DataConn(txConn)
      await txClient.begin()
      let result = await callback(txClient)
      await txClient.commit()

      return result
    } catch (err) {
      await txClient.rollback()
      throw err
    }
  }

  return {
    client,
    query,
    session,
    transaction
  }
}

const provider = async system => {
  const details = _.get(Config, 'badger.pg.conn')
  if (!details) {
    throw new Error('No badger.pg.conn details provided')
  }
  const connectionString = parseUrl(details)

  const pool = new Pool({ connectionString })
  const conn = await connection(pool, system)
  const pg = {
    connection: conn,
    client: await DataConn(await conn({}))
  }
  return pg
}

const hook = system => {
  system.provide(1, 'pg', provider)
}

module.exports = {
  hook
}

// const CREDENTIAL_ID = process.env.ESCALATION_CREDENTIAL_ID || 1
// const MEMBER_ID = process.env.ESCALATION_MEMBER_ID || null

function parseJson(val) {
  if (val == null) {
    return val
  }
  const json = JSON.parse(val)
  return camelize(json)
}

function configureTypes() {
  // configure BIGDECIMAL and BIGINT to be numbers, not strings
  types.setTypeParser(20, val => parseInt(val))
  types.setTypeParser(701, val => parseInt(val))

  // JSON / JSON[]
  types.setTypeParser(114, parseJson)
  types.setTypeParser(119, parseJson)

  // JSONB / JSONB[]
  types.setTypeParser(3802, parseJson)
  types.setTypeParser(3807, parseJson)
}
configureTypes()

function configureJsonDeserializer() {
  const queryProto = Query.prototype
  const handleRowDesc = queryProto.handleRowDescription
  queryProto.handleRowDescription = function(msg) {
    msg.fields.forEach(field => {
      field.name = camelize(field.name)
    })
    return handleRowDesc.call(this, msg)
  }
}
configureJsonDeserializer()

// const queryTemplates = {}
// const sqlFilesPath = path.resolve(__dirname, '../sql')
// const sqlFiles = readdirSync(sqlFilesPath)
// sqlFiles.forEach(file => {
//   const [name] = file.split('.sql')
//   queryTemplates[name] = require(`${__dirname}/../sql/${file}`)
// })

// const mapTemplates = pool => value => {
//   return R.mapObjIndexed(mapQueries(pool), value)
// }

// const mapQueries = pool => value => {
//   const rootFn = params => {
//     return pool.query(yesql(value)(params))
//   }
//   rootFn.one = async params => R.path(['rows', 0], await rootFn(params))
//   rootFn.many = async params => R.pathOr([], ['rows'], await rootFn(params))
//   rootFn.sql = value

//   return rootFn
// }
// const DBO = pooled => R.mapObjIndexed(mapTemplates(pooled), queryTemplates)

// const prepareConnection = async claims => {
//   const client = await pool.connect()
//   const dbo = await DBO(client)

//   if (claims) {
//     const sqlArr = Object.keys(claims).map((prop, idx) => {
//       const setting = prop == 'role' ? prop : 'jwt.claims.' + prop
//       const value = SafeSQL.value(claims[prop])
//       return SafeSQL.query`set_config(${SafeSQL.value(
//         setting
//       )}, ${value}, true)`
//     })
//     const assumeQuery = SafeSQL.compile(
//       SafeSQL.query`select ${SafeSQL.join(sqlArr, ', ')}`
//     )

//     await client.query('begin')
//     await client.query(assumeQuery)
//   }

//   const transaction = async callback => {
//     try {
//       await client.query('BEGIN')
//       let result = await callback(client, dbo)
//       await client.query('COMMIT')

//       return result
//     } catch (err) {
//       await client.query('ROLLBACK')
//       throw err
//     }
//   }

//   client.transaction = transaction
//   client.q = (sql, params) => client.query(yesql(sql)(params))

//   const dbSession = {
//     commit: async () => {
//       await client.query('commit')
//     },
//     rollback: async err => {
//       await client.query('rollback')
//       throw err
//     }
//   }

//   return { dbSession, client, dbo }
// }

// let rootAssumeQuery
// const escalatePrivileges = async callback => {
//   const client = await pool.connect()
//   const dbo = await DBO(client)

//   if (!rootAssumeQuery) {
//     const rootQuery = await dbo.iam.getRole({
//       credentialId: CREDENTIAL_ID,
//       memberId: MEMBER_ID
//     })
//     const root = rootQuery.rows[0]

//     const sqlArr = Object.keys(root).map((prop, idx) => {
//       const setting = prop == 'role' ? prop : 'jwt.claims.' + prop
//       const value = SafeSQL.value(root[prop])
//       return SafeSQL.query`set_config(${SafeSQL.value(
//         setting
//       )}, ${value}, true)`
//     })
//     rootAssumeQuery = SafeSQL.compile(
//       SafeSQL.query`select ${SafeSQL.join(sqlArr, ', ')}`
//     )
//   }

//   try {
//     await client.query('BEGIN')
//     await client.query(rootAssumeQuery)
//     const result = await callback(client, dbo)
//     await client.query('COMMIT')

//     return result
//   } catch (e) {
//     await client.query('ROLLBACK')
//     throw e
//   } finally {
//     await client.release()
//   }
// }

// module.exports = {
//   DBO,
//   pool,
//   prepareConnection,
//   escalatePrivileges
// }
