import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
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

app.post('/participants', async (req, res) => { 
  const { name } = req.body;

  if(name.length < 1) return res.sendStatus(422);

  const verifyName = await db.collection('participants').findOne({ name });

  if(verifyName) return res.sendStatus(409);

  const lastStatus = Date.now();

  await db.collection('participants').insertOne({ name, lastStatus });
  await db.collection('messages').insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(lastStatus).format('HH:mm:ss') });

  return res.sendStatus(201);
});

app.listen(5000);

// Formato de um participante
// {name: 'João', lastStatus: 12313123} // *lastStatus

// Formato de uma mensagem
// {from: 'João', to: 'Todos', text: 'oi galera', type: 'message', time: '20:04:37'}
