import express from "express";
import { connectToDatabase } from "../lib/db.js";
//import bcrypt from 'bcrypt';
import md5 from 'md5';
import jwt from "jsonwebtoken";

const router = express.Router();

router.post('/login', async (req,res)=>{
    const {email,password} = req.body;
    try {
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT * FROM users WHERE status ="Active" and email =?',[email])
        if(rows.length===0)
        {
            return res.status(403).json({message:"User not Exist!"})
        }

        //const isMatched = await bcrypt.compare(password,rows[0].password)
        if(md5(password)!=rows[0].password)
        {
            return res.status(403).json({message:"Incorrect Password!"})
        }

        const token = jwt.sign({id:rows[0].id},process.env.JWT_KEY,{expiresIn:"3h"})
        return res.status(200).json({userId: rows[0].id,name: rows[0].name,token:token,userType:rows[0].userType})

    } catch (error) {
        res.status(500).json(error.message)
    }
})

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
        return res.status(500).json({message:"server error"})
    }  
}

router.get('/authenticate', verifyToken, async (req,res)=>{
    try {
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT * FROM users WHERE id =?',[req.userId])
        if(rows.length===0)
        {
            return res.status(403).json({message:"User not Exist!"})
        }

        return res.status(200).json(rows)
    } catch (error) {
        res.status(500).json({message:"Server Error"})
    }
})

router.post('/checkuser', async (req,res)=>{
    const {userId,verifyOtp} = req.body;
    try {
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT * FROM users WHERE id =? AND verify = ?',[userId,verifyOtp])
        if(rows.length===0)
        {
            return res.status(403).json({message:"User not Exist!"})
        }
        return res.status(200).json(rows)
        
    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.put('/createpassword', async (req,res)=>{
    const {id,password} = req.body;
    try {
        if(id && password)
        {
            //console.log(req.body);
            const db = await connectToDatabase()
            const [rows] = await db.query('SELECT * FROM users WHERE id =?',[id])
            if(rows.length===0)
            {
                return res.status(403).json({message:"User not Exist!"})
            }

            //const password = 'hjksd798jhj3';
            //const d = new Date();
            //const formattedDate = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
            //const hashPassword = await bcrypt.hash(password,10)
            const hashPassword = await md5(password)
            //await db.query("INSERT INTO users (name, email,employeeId,password,decryptPassword,addedon) VALUES (?,?,?,?,?,?)", [name, email, employeeId, hashPassword,password,formattedDate])
            await db.query("UPDATE users set password = ?, decryptPassword = ?, verify = ? WHERE id = ?",[hashPassword,password,null,id])
            return res.status(200).json({message:"Password Created Successfully!"}) 
        }
        else
        {
            return res.status(403).json({message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

export default router;