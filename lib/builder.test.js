const { Builder } = require('./builder')

test('go', async () => {
  const { app } = await Builder().build()

  console.log(app)
})
