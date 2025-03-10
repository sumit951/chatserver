import express from "express";
import cors from "cors";
import { connectToDatabase } from "./lib/db.js";
import { Server } from 'socket.io';
import authRouter from './routes/authRoutes.js'
import userRouter from './routes/userRoutes.js'
import chatRouter from './routes/chatRoutes.js'

const db = await connectToDatabase()
const app = express();

app.use(cors())
app.use(express.json())

//const httpServer = createServer();

const expressServer = app.listen(process.env.PORT, () => {
  console.log('Server is Running');
})


const socketIO = new Server(expressServer, {
  cors: {
    //origin: "http://localhost:5173",
    origin: "https://rc-chatapp.vercel.app/",
    methods: ["GET", "POST"]
  }
});

const activeUsers = [];

socketIO.on('connection', (socket) => {
    console.log(`⚡: ${socket.id} user just connected!`);
  
    //Listens and logs the message to the console
    socket.on('message', (data) => {
      console.log(data);

      //const newchat = db.query(`SELECT * FROM messages WHERE ((senderId = ${data.senderId} AND receiverId = ${data.receiverId}) OR (senderId = ${data.receiverId} AND receiverId = ${data.senderId})) AND groupId IS NULL`)
      
      db.query("INSERT INTO messages (senderName, senderId,receiverId,message,messageType) VALUES (?,?,?,?,?)", [data.senderName, data.senderId, data.receiverId, data.message, data.messageType])
      
      //return res.status(200).json({status:'success',message:"success"})
      
      //socketIO.emit('savedmessageResponse', newchat);
      socketIO.emit('messageResponse', data);
    });

    socket.on('typing', (data) => socket.broadcast.emit('typingResponse', data));

    //Listens when a new user joins the server
    socket.on('newUser', (data) => {
      //Adds the new user to the list of activeUsers
      console.log(activeUsers);
      const val = { userId: data.userId };
      if(data.socketID && !activeUsers.some(activeUsers => activeUsers.userId === data.userId))
      {
        activeUsers.push(data);
        //console.log(activeUsers);
      }
      //Sends the list of activeUsers to the client
      socketIO.emit('newUserResponse', activeUsers);
    });
  
    socket.on('disconnect', (data) => {
      console.log('🔥: A user disconnected');
      if(data.socketID && !activeUsers.some(activeUsers => activeUsers.userId === data.userId))
      {
        activeUsers.push(data);
        //console.log(activeUsers);
      }
      socketIO.emit('newUserResponse', activeUsers);
    });
});

app.use('/auth', authRouter)
app.use('/user', userRouter)
app.use('/chat', chatRouter)

/*app.listen(process.env.PORT, () => {
    console.log('Server is Running');
})*/

/*httpServer.listen(process.env.PORT, () => {
  console.log(`Server listening`);
});*/