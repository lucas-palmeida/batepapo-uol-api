import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";

dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect();
} catch(err) {
  console.log(err.message);
}

const db = mongoClient.db();

const app = express();

app.use(cors());
app.use(express.json());

setInterval(async () => {
  const now = dayjs(Date.now());
  const participants = await db.collection('participants').find();

  participants.forEach(async participant => {
    if(now.diff(dayjs(participant.lastStatus), 'second') > 10) {
      await db.collection('participants').deleteOne({ name: participant.name });
      await db.collection('messages').insertOne({ from: participant.name, to: 'Todos', text: 'sai na sala...', type: 'status', time: dayjs(now).format('HH:mm:ss') });
    }
  })
}, 15000);

app.post('/participants', async (req, res) => {
  const participant = req.body;
  const participantSchema = Joi.object({
    name: Joi.string().min(1).required(),
  })
  
  try {
    const validation = participantSchema.validate(participant, { abortEarly: false });

    if(validation.error) return res.sendStatus(422);

    const verifyName = await db.collection('participants').findOne({ name: participant.name });

    if(verifyName) return res.sendStatus(409);

    const lastStatus = Date.now();

    await db.collection('participants').insertOne({ name: participant.name, lastStatus });
    await db.collection('messages').insertOne({ from: participant.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(lastStatus).format('HH:mm:ss') });

    return res.sendStatus(201);
  } catch(err) {
    return res.status(500).send(err);
  }
});

app.get('/participants', async (req, res) => {
  try {
    const participants = await db.collection('participants').find().toArray();
    
    return res.send(participants);
  } catch(err) {
    return res.status(500).send(err);
  }
});

app.post('/messages', async (req, res) => {
  const message = req.body; // { to, text, type }
  const from = req.headers.user;

  const messageSchema = Joi.object({
    to: Joi.string().min(1).required(),
    text: Joi.string().min(1).required(),
    type: Joi.string().min(7).required(),
  })

  try {
    const validation = messageSchema.validate(message, { abortEarly: false });

    if(validation.error || (message.type !== 'message' && message.type !== 'private_message')) return res.sendStatus(422);

    const verifyParticipant = await db.collection('participants').findOne({ name: from});
  
    if(!verifyParticipant) return res.sendStatus(422);

    await db.collection('messages').insertOne({ from, to: message.to, text: message.text, type: message.type, time: dayjs().format('HH:mm:ss') });

    return res.sendStatus(201);
  } catch(err) {
    return res.status(500).send(err);
  }
});

app.get('/messages', async (req, res) => {
  const from = req.headers.user;
  let limit = parseInt(req.query.limit);

  try {
    if(limit <= 0 || (isNaN(limit) && limit === undefined)) return res.sendStatus(422);
    
    const messages = await db.collection('messages').find().toArray();
    const filteredMessages = messages.filter(message => message.to === 'Todos' || message.to === from || message.from === from).reverse();

    if(filteredMessages.length > limit) {
      return res.send(filteredMessages.slice(0, limit));
    }

    return res.send(filteredMessages);
  } catch(err) {
    return res.status(500).send(err);
  }
})

app.post('/status', async (req, res) => {
  const name = req.headers.user;
  const verifyParticipant = await db.collection('participants').findOne({ name });

  if(!verifyParticipant) return res.sendStatus(404);

  await db.collection('participants').updateOne({ name }, { $set: { lastStatus: Date.now() }});
  return res.sendStatus(200);
})

app.listen(5000);

// Formato de um participante
// {name: 'João', lastStatus: 12313123} // *lastStatus

// Formato de uma mensagem
// {from: 'João', to: 'Todos', text: 'oi galera', type: 'message', time: '20:04:37'}
