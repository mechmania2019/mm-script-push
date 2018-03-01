const { promisify } = require('util')

const mongoose = require('mongoose')
const AWS = require('aws-sdk')
const uuid = require('node-uuid')
const authenticate = require('mm-authenticate')(mongoose)
const { Team, Script } = require('mm-schemas')(mongoose)
const { send, buffer } = require('micro')

mongoose.connect(process.env.MONGO_URL)
mongoose.Promise = global.Promise

const s3 = new AWS.S3({
  params: { Bucket: 'mechmania' }
})

const upload = promisify(s3.upload.bind(s3))

module.exports = authenticate(async (req, res) => {
  const urlParams = req.url.split('/')
  if(urlParams.length !== 2) {
    return send(res, 400, 'Malformed URL')
  }
  const [_, name] = urlParams

  // Find team
  const team = await Team.findOne({name}).exec()

  if(!team) {
    return send(res, 404, `Team ${name} not found`)
  }
  if(!team.canBeAccessedBy(req.user)) {
    return send(res, 401, 'Unauthorized')
  }

  // Pipe file to s3
  const body = await buffer(req)
  const scriptName = uuid.v4()
  const key = 'scripts/' + scriptName

  const data = await upload({
    Key: key,
    Body: body
  })

  // Add URL to mongo
  const script = new Script({
    key,
    url: data.Location,
    owner: team
  })
  await script.save()
  team.latestScript = script
  await team.save()

  send(res, 200, data)
})