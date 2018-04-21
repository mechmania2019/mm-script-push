const { promisify } = require('util')

const mongoose = require('mongoose')
const AWS = require('aws-sdk')
const uuid = require('node-uuid')
const authenticate = require('mm-authenticate')(mongoose)
const { Team, Script } = require('mm-schemas')(mongoose)
const { send, buffer } = require('micro')

const amqp = require('amqplib');
const RABBITMQ_URI = process.env.RABBITMQ_URI ||'amqp://localhost';
const COMPILER_QUEUE = `compilerQueue`;

mongoose.connect(process.env.MONGO_URL)
mongoose.Promise = global.Promise

const s3 = new AWS.S3({
  params: { Bucket: 'mechmania' }
})

const upload = promisify(s3.upload.bind(s3))

module.exports = authenticate(async (req, res) => {
  // console.log(req)
  // console.log(re)
  // console.log
  const urlParams = req.url.split('/')
  if(urlParams.length !== 2) {
    return send(res, 400, 'Malformed URL')
  }
  const [_, name] = urlParams
  console.log(name)

  // Find team
  const team = await Team.findOne({name}).exec()


  if(!team) {
    return send(res, 404, `Team ${name} not found`)
  }

  if(!team.canBeAccessedBy(req.user)) {
    return send(res, 401, 'Unauthorized')
  }

  // // Pipe file to s3
  const body = await buffer(req)
  const scriptName = uuid.v4()
  const key = 'scripts/' + scriptName


  const data = await upload({
    Key: key,
    Body: body
  })

  // // Add URL to mongo
  const script = new Script({
    key,
    url: data.Location,
    owner: team
  })
  await script.save()
  team.latestScript = script
  await team.save()

  // console.log(data.key)

  const conn = await amqp.connect(RABBITMQ_URI);
  const ch = await conn.createChannel();
  ch.assertQueue(COMPILER_QUEUE, {durable: true});
  ch.sendToQueue(COMPILER_QUEUE, new Buffer(data.key), {persistent: true});

  ch.consume(COMPILER_QUEUE, async message => {
    const id = message.content.toString();
    console.log(id)
    ch.ack(message)
  }, {noAck: false})

  send(res, 200, data)
})