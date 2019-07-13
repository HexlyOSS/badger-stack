const Logger = arg => {
  const name = arg.replace(process.cwd() + '/', '')

  // TODO winston this bad boy
  return {
    info(...args) {
      console.log(`[${name}]`, { ...args })
    }
  }
}

module.exports = {
  Logger
}
