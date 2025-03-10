import express from "express";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "../lib/db.js";

const router = express.Router();

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers['authorization'].split(' ')[1];
        if(!token){
            return res.statu(401).json({message:"No token provided"}) 
        }

        const decoded = jwt.verify(token,process.env.JWT_KEY)
        req.userId = decoded.id
        next()
    } catch (error) {
        return res.status(500).json({message:"server error1"})
    }  
}

router.get('/getuserchat/:id', verifyToken, async (req,res)=>{
    try {
        let senderid  = req.params.id;
        //console.log(req.userId);
        if(senderid)
        {
            const decodeSenderid = atob(senderid)
            const db = await connectToDatabase()
            //const [rows] = await db.query('SELECT * FROM messages WHERE (senderid =? or receiverId =?) and receiverId=?',[req.userId,req.userId,decodeSenderid])
            const [rows] = await db.query(`SELECT * FROM messages WHERE ((senderId = ${req.userId} AND receiverId = ${decodeSenderid}) OR (senderId = ${decodeSenderid} AND receiverId = ${req.userId})) AND groupId IS NULL `)
            return res.status(200).json(rows)
        }
        else
        {
            return res.status(500).json({message:"server error2"})
        }
    } catch (error) {
        res.status(500).json({message:error})
    }
})

export default router;