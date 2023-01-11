import express, { json } from "express";
import cors from "cors";

const server = express();
const PORT = 5000;

server.use(cors());
server.use(json());

server.listen(PORT, () => {
  console.log("Aplicação rodando em http://localhost:5000");
});
