const _ = require('lodash')
const levels = require('../levels')

const SYSTEM_KEY = 'dbo'
const PREFIX_JS = 'sql'

const recurse = (obj, ctx, path = []) => {
  const convert = (prop, sql) => {
    // TODO: add error handling using the prop
    const { pg: rootPG } = ctx.system

    const query = async (params = {}, pg = rootPG, cfg) => {
      try {
        const conn = pg.client // TODO not hardcode this
        // const conn = await pg.conn(cfg)
        return conn.query(sql, params)
      } catch (err) {
        const joined = path.join('.') + '.' + prop
        const msg = `[dbo] Query [ ${joined} ] failed: ${err.message}`
        console.warn(msg, err)
        const e = new Error(msg, err)
        e.sql = sql
        e.path = joined
        throw e
      }
    }

    const one = async (params, pg, cfg) =>
      _.get(await query(params, pg, cfg), 'rows.0', null)
    const many = async (params, pg, cfg) =>
      _.get(await query(params, pg, cfg), 'rows', [])
    const raw = (params, pg, cfg) => query(params, pg, cfg)

    const err = async params => {
      const msg = 'Database isnt real'
      throw new Error(msg)
    }

    return {
      sql,
      one,
      many,
      raw,
      // used for testing
      err
    }
  }

  Object.keys(obj).forEach(prop => {
    const value = obj[prop]
    switch (typeof value) {
      case 'object':
        path.push(prop)
        recurse(value, ctx, path)
        break

      case 'string':
        obj[prop] = convert(prop, value.trim())
        break

      default:
        console.log('Ignoring', { prop, value })
        break
    }
  })
}

const transform = (sqljs, ctx) => {
  recurse(sqljs, ctx)
}

const hook = system => {
  system.scan(levels.SYSTEM, SYSTEM_KEY, PREFIX_JS)

  // hook into the "dbo" being scanned
  let resolve, reject, dbo
  system.on(`resolution:resolved:${SYSTEM_KEY}`, ({ waiter, resolved }) => {
    waiter(
      new Promise((res, rej) => {
        resolve = res
        reject = rej
        dbo = resolved
      })
    )
  })

  // once the entire system is resolved, convert the sql to functions
  system.on('resolution:complete', ctx => {
    try {
      transform(dbo, ctx)
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = {
  hook,
  transform
}
