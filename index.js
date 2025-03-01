import express from "express";
import cors from "cors";
import authRouter from './routes/authRoutes.js'
import userRouter from './routes/userRoutes.js'

const app = express();

app.use(cors())
app.use(express.json())
app.use('/auth', authRouter)
app.use('/user', userRouter)

app.listen(process.env.PORT, () => {
    console.log('Server is Running');
})