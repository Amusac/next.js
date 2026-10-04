const fs = require('fs')
const path = require('path')

fs.appendFileSync(
  path.join(__dirname, 'opened-files.jsonl'),
  JSON.stringify(process.argv.slice(2)) + '\n'
)
