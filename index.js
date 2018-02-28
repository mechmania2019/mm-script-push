const { promisify } = require('util')

const mongoose = require('mongoose')
const AWS = require('aws-sdk')
const uuid = require('node-uuid')
const { Team, Script } = require('mm-schemas')(mongoose)
const { send, buffer } = require('micro')

mongoose.connect(process.env.MONGO_URL)
mongoose.Promise = global.Promise

const s3 = new AWS.S3({
  params: { Bucket: 'mechmania' }
})

const upload = promisify(s3.upload.bind(s3))

module.exports = async (req, res) => {
  const urlParams = req.url.split('/')
  if(urlParams.length !== 2) {
    send(res, 400, 'Malformed URL')
    return
  }
  const [_, name] = urlParams

  // Find team
  const team = await Team.findOne({name}).exec()

  if(!team) {
    send(res, 404, `Team ${name} not found`)
    return;
  }

  // Pipe file to s3
  const body = await buffer(req)
  const scriptName = uuid.v4();

  const data = await upload({
    Key: 'scripts/' + scriptName,
    Body: body
  })

  // Add URL to mongo
  const script = new Script({
    url: data.Location,
    owner: team
  })
  await script.save()
  team.latestScript = script
  await team.save()

  send(res, 200, data)
}