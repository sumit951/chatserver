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


router.post('/creategroup', verifyToken, async (req,res)=>{
    const {groupName,selectUsers,employeeId,userType,chatDeleteInDays} = req.body;
    try {
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT * FROM groups WHERE groupName =?',[groupName])
        if(rows.length>0)
        {
            return res.status(200).json({status:'fail',message:"Group Name Already Exist!"})
        }
        const d = new Date();
        const formattedDate = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
        const totalMember = parseInt(selectUsers.length+1)
        const response = await db.query("INSERT INTO groups (groupName, createdBy, totalMember, createdAt) VALUES (?,?,?,?)", [groupName, req.userId, totalMember, formattedDate]) 
        
        

        const groupid = response[0].insertId;
        if(groupid)
        {
            await db.query("INSERT INTO group_members (groupId, userId,joinedAt) VALUES (?,?,?)", [groupid, req.userId,formattedDate])
            selectUsers.map( async (user)=>{
                //console.log(user.value);
                await db.query("INSERT INTO group_members (groupId, userId,joinedAt) VALUES (?,?,?)", [groupid, user.value,formattedDate])
            })
        }
        
        return res.status(200).json({status:'success',message:"Group Created Successfully!"})
        
    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.get('/getgrouplist', verifyToken, async (req,res)=>{
    try {
        const db = await connectToDatabase()
        //const [rows] = await db.query(`SELECT groupId, groupName, upper(left(groupName,1)) as groupshortName FROM groups where createdBy = ${req.userId} ORDER BY groupId desc`)
        const [rows] = await db.query(`SELECT group_members.groupId, groups.groupName, groups.totalMember, upper(left(groups.groupName,1)) as groupshortName FROM group_members INNER JOIN groups ON groups.groupId = group_members.groupId WHERE group_members.userId = ${req.userId}`)
        if(rows.length===0)
        {
            return res.status(403).json({message:"Empty group list!"})
        }

        return res.status(200).json(rows)

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.get('/getgroupchat/:groupid', verifyToken, async (req,res)=>{
    try {
        let groupid  = req.params.groupid;
        if(groupid)
        {
            const decodegroupid = atob(groupid)
            const db = await connectToDatabase()
            const [rows] = await db.query(`SELECT * FROM messages WHERE groupId = ${decodegroupid} AND receiverId IS NULL `)
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