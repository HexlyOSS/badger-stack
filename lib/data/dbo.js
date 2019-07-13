const levels = require('../levels')

const SYSTEM_KEY = 'dbo'
const PREFIX_JS = 'sql'

const recurse = (obj, ctx, path = []) => {
  const convert = (prop, sql) => {
    // TODO: add error handling using the prop
    const { db } = ctx.system

    const one = async params => {
      const { rows } = await db.query(sql, params)
      return rows.length > 0 ? rows[0] : null
    }

    const many = async params => (await db.query(sql, params)).rows
    const raw = params => db.query(sql, params)

    const err = async params => {
      const msg = 'Database isnt real'
      throw new Error(msg)
    }

    const wrap = fn => async params => {
      try {
        return await fn(params)
      } catch (err) {
        const joined = path.join('.') + '.' + prop
        const msg = `[dbo] Query [ ${joined} ] failed: ${err.message}`
        const e = new Error(msg, err)
        e.sql = sql
        e.path = joined
        throw e
      }
    }

    return {
      sql: wrap(sql),
      one: wrap(one),
      many: wrap(many),
      raw: wrap(raw),
      // used for testing
      err: wrap(err)
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
