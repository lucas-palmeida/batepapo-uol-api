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
  const name = req.body;
  const participantSchema = Joi.object({
    name: Joi.string().min(1).required(),
  })
  
  // if(name === undefined || name.length < 1) return res.sendStatus(422);

  try {
    const validation = participantSchema.validate(name, { abortEarly: false });

    if(validation.error) return res.sendStatus(422);

    const verifyName = await db.collection('participants').findOne({ name });

    if(verifyName) return res.sendStatus(409);

    const lastStatus = Date.now();

    await db.collection('participants').insertOne({ name, lastStatus });
    await db.collection('messages').insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(lastStatus).format('HH:mm:ss') });

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
  const { to, text, type } = req.body;
  const from = req.headers.user;

  if(to.length < 1 || text.length < 1 || to === undefined || text === undefined) return res.sendStatus(422);
  if(type !== 'message' && type !== 'private_message') return res.sendStatus(422);

  try {
    const verifyParticipant = await db.collection('participants').findOne({ name: from});
  
    if(!verifyParticipant) return res.sendStatus(422);

    await db.collection('messages').insertOne({ from, to, text, type, time: dayjs().format('HH:mm:ss') });

    return res.sendStatus(201);
  } catch(err) {
    return res.status(500).send(err);
  }
});

app.get('/messages', async (req, res) => {
  const from = req.headers.user;
  let limit = parseInt(req.query.limit);
  
  try {
    const messages = await db.collection('messages').find().toArray();
    const filteredMessages = messages.filter(message => message.to === 'Todos' || message.to === from || message.from === from);

    if(filteredMessages.length > limit && !isNaN(limit)) {
      limit = filteredMessages.length - limit;
      return res.send(filteredMessages);
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
