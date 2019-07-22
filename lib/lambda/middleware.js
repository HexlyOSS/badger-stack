/**
 * Creates both a `lambda` and `middy` namespace on the `system`.
 * Creates `lambda.bindMiddleware(handler, cfg)` for creating `middy` wrapped
 * lambda functions.
 */

const _ = require('lodash')
const Config = require('config')
const middy = require('middy')
const middymw = require('middy/middlewares')
const levels = require('../levels')

const defaultMiddyMw = ['httpEventNormalizer', 'httpHeaderNormalizer']

const SYSTEM_KEY = 'middy'
const PREFIX_JS = 'middy'

const SystemMiddleware = system => cfg => ({
  before: (handler, next) => {
    handler.context.system = system
    next()
  }
})

const hook = system => {
  system.scan(levels.SYSTEM, SYSTEM_KEY, PREFIX_JS)

  let res, rej
  const promise = new Promise((resolve, reject) => {
    res = resolve
    rej = reject
  })

  system.lambda = system.lambda || {}
  system.lambda.bindMiddleware = (handler, cfg) => (
    event,
    context,
    callback
  ) => {
    promise.then(middleware => {
      const targets = [SystemMiddleware(system)].concat(middleware)
      const wrapped = targets.reduce((h, mw) => {
        let settings = {}
        let { name } = mw
        if (typeof mw === 'object') {
          settings = _.get(cfg, ['middy', mw.name])
          mw = mw.middleware
        }

        if (mw instanceof Function === false) {
          throw new Error('Middy middleware did not resolve to function', {
            name,
            settings,
            mw
          })
        }

        return h.use(mw(settings))
      }, middy(handler))
      wrapped(event, context, callback)
    })
  }

  system.on(`resolution:resolved:${SYSTEM_KEY}`, ({ resolved }) => {
    const copy = { ...resolved }

    if (Config.badger.middy.defaults) {
      console.log('[badger.middy] Loading default middy middleware')
      defaultMiddyMw.forEach(name => {
        const middleware = (cfg = {}) => ({ ...middymw[name](cfg) })
        copy[name] = { name, middleware }
      })

      // TODO put some defaults on!
      // waiter( new Promise( (res, rej) => {...}) )
    }

    const middlewares = Object.keys(copy)
      .sort((a, b) => (a.priority || 9999) - (b.priority - 9999))
      .reduce((mw, prop) => mw.push(copy[prop]) && mw, [])

    res(middlewares)
  })
}

module.exports = {
  hook,
  SystemMiddleware
}
