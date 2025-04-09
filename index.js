import express from "express";
import multer from "multer";
import path from "path";
import cors from "cors";
import { connectToDatabase } from "./lib/db.js";
import { Server } from 'socket.io';
import authRouter from './routes/authRoutes.js'
import userRouter from './routes/userRoutes.js'
import chatRouter from './routes/chatRoutes.js'
import dotenv from 'dotenv';
dotenv.config();

const db = await connectToDatabase()
const app = express();

app.use(cors('*'))
app.use(express.json())

//const httpServer = createServer();
const expressServer = app.listen(process.env.PORT, () => {
  console.log('Server is Running');
})


const socketIO = new Server(expressServer, {
  cors: {
    origin: "*",
    //origin: "https://rc-chatapp.vercel.app",
    //origin: "https://rapidcollaborate.in/chat-app",
    methods: ["GET", "POST"],
    allowedHeaders: ['Content-Type'],
  }
});

const activeUsers = [];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
app.use('/uploads', express.static('uploads'));

app.post("/upload", upload.array("files", 5), (req, res) => {
  console.log("Files uploaded:", req.files);
  res.send({ message: "Files uploaded successfully", files: req.files });
});

socketIO.on('connection', (socket) => {
    console.log(`⚡: ${socket.id} user just connected!`);
  
    //Listens and logs the message to the console
    socket.on('message', async (data) => {
      
      if(data.senderId)
      {
        const response = await db.query("INSERT INTO messages (senderName, senderId,receiverId,message,messageType) VALUES (?,?,?,?,?)", [data.senderName, data.senderId, data.receiverId, data.message, data.messageType])

        const messageId = response[0].insertId;
        data["messageId"] = messageId;
        data["deleteSts"] = 'No';
        //console.log(data);
        
        //return res.status(200).json({status:'success',message:"success"})
        
        //socketIO.emit('savedmessageResponse', newchat);
        socketIO.emit('messageResponse', data);
      }
      
    });

    socket.on('editMessage', (updatedMsg) => {
      socketIO.emit('updatedMessage', updatedMsg);
    });

    socket.on('editMessageGroup', (updatedMsg) => {
      socketIO.emit('updatedMessageGroup', updatedMsg);
    });

    socket.on('messagegroup', async (data) => {
      console.log(data);
      
      const response = await db.query("INSERT INTO messages (senderName,senderId, groupId,message,messageType) VALUES (?,?,?,?,?)", [data.senderName, data.senderId, data.groupId, data.message, data.messageType])

      const messageId = response[0].insertId;
      data["messageId"] = messageId;
      data["deleteSts"] = 'No';
      //return res.status(200).json({status:'success',message:"success"})
      
      //socketIO.emit('savedmessageResponse', newchat);
      socketIO.emit('messagegroupResponse', data);
    });

    socket.on('typing', (data) => socket.broadcast.emit('typingResponse', data));

    //Listens when a new user joins the server
    socket.on('newUser', (data) => {
      //Adds the new user to the list of activeUsers
      //console.log(activeUsers);
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

    socket.on('setChatStatus', (data) => socket.broadcast.emit('reloadChatStatus', data));

    socket.on('replyMessage', async (data) => {
      //console.log(data);
      
      if(data.senderId)
      {
        const response = await db.query("INSERT INTO messages (senderName, senderId,receiverId,message,messageType,replyTo) VALUES (?,?,?,?,?,?)", [data.senderName, data.senderId, data.receiverId, data.message, data.messageType, data.replyTo])

        const messageId = response[0].insertId;
        data["messageId"] = messageId;
        data["replyTo"] = data.replyTo;
        data["deleteSts"] = 'No';
        //console.log(data);
        
        //return res.status(200).json({status:'success',message:"success"})
        
        //socketIO.emit('savedmessageResponse', newchat);
        socketIO.emit('messageResponseReply', data);
      }
      
    });

    socket.on('replyMessageGroup', async (data) => {
      //console.log(data);
      
      const response = await db.query("INSERT INTO messages (senderName,senderId, groupId,message,messageType,replyTo) VALUES (?,?,?,?,?,?)", [data.senderName, data.senderId, data.groupId, data.message, data.messageType, data.replyTo])

      const messageId = response[0].insertId;
      data["messageId"] = messageId;
      data["deleteSts"] = 'No';
      //return res.status(200).json({status:'success',message:"success"})
      
      //socketIO.emit('savedmessageResponse', newchat);
      socketIO.emit('messagegroupResponseReply', data);
    });

    socket.on('sendaddmemberrequest', (data) => {
      console.log(data);
      
      socket.broadcast.emit('reloadaddmemberrequest', data)
      }
    );

    socket.on('pinStatusUpdated', (data) => {
      //console.log(data);
      socket.broadcast.emit('reloadpinStatusUpdated', data)
      }
    );
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