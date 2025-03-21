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
    const {groupName,selectUsers} = req.body;
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
        const [rows] = await db.query(`SELECT group_members.groupId, groups.groupName, groups.totalMember, groups.createdBy, upper(left(groups.groupName,1)) as groupshortName FROM group_members INNER JOIN groups ON groups.groupId = group_members.groupId WHERE group_members.userId = ${req.userId}`)
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

router.get('/getgroupmember/:groupid', verifyToken, async (req,res)=>{
    try {
        let groupid  = req.params.groupid;
        if(groupid)
        {
            const decodegroupid = atob(groupid)
            const db = await connectToDatabase()
            const [rows] = await db.query(`SELECT group_members.groupId, group_members.userId, users.name as userName, users.email as userEmail, upper(left(name,1)) as usershortName FROM group_members INNER JOIN users ON users.id = group_members.userId WHERE group_members.groupId = ${decodegroupid}`)
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

router.delete('/deletegroup/:id', verifyToken, async (req,res)=>{
    try {
        let id  = req.params.id;
        if(id)
        {
            const decodeGroupid = atob(id)
            const db = await connectToDatabase()
            await db.query("DELETE FROM messages WHERE groupId = ?", [decodeGroupid])
            await db.query("DELETE FROM group_members WHERE groupId = ?", [decodeGroupid])
            await db.query("DELETE FROM groups WHERE groupId = ?", [decodeGroupid])

            return res.status(200).json({status:'success',message:"Group Deleted Successfully!"}) 
        }
        else
        {
            return res.status(403).json({status:'fail',message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.delete('/deletegroupmember/:userid/:groupid/:totalmember', verifyToken, async (req,res)=>{
    try {
        let userid  = req.params.userid;
        let groupid  = req.params.groupid;
        let totalmember  = req.params.totalmember;
        if(userid && groupid && totalmember)
        {
            const decodeUserid = atob(userid)
            const decodeGroupid = atob(groupid)
            const decodetotalmember = atob(totalmember)

            const db = await connectToDatabase()
           
            await db.query(`DELETE FROM messages WHERE groupId = ${decodeGroupid} and senderId = ${decodeUserid}`)
            await db.query(`DELETE FROM group_members WHERE groupId = ${decodeGroupid} and userId = ${decodeUserid}`)

            const decodetotalmemberleft = parseInt(decodetotalmember-1);
            
            await db.query("UPDATE groups set totalMember = ? WHERE groupId = ?",[decodetotalmemberleft,decodeGroupid])

            return res.status(200).json({status:'success',message:"Member Deleted Successfully!"}) 
        }
        else
        {
            return res.status(403).json({status:'fail',message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.delete('/leavegroupspace/:userid/:groupid/:totalmember', verifyToken, async (req,res)=>{
    try {
        let userid  = req.params.userid;
        let groupid  = req.params.groupid;
        let totalmember  = req.params.totalmember;
        if(userid && groupid && totalmember)
        {
            const decodeUserid = atob(userid)
            const decodeGroupid = atob(groupid)
            const decodetotalmember = atob(totalmember)
            //console.log(decodeUserid+'----'+decodeGroupid+'----'+decodetotalmember);
            
            const db = await connectToDatabase()
            await db.query(`DELETE FROM messages WHERE groupId = ${decodeGroupid} and senderId = ${decodeUserid}`)
            await db.query(`DELETE FROM group_members WHERE groupId = ${decodeGroupid} and userId = ${decodeUserid}`)

            const decodetotalmemberleft = parseInt(decodetotalmember-1);
            
            await db.query("UPDATE groups set totalMember = ? WHERE groupId = ?",[decodetotalmemberleft,decodeGroupid])

            return res.status(200).json({status:'success',message:"Group Leaved Successfully!"}) 
        }
        else
        {
            return res.status(403).json({status:'fail',message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.post('/addmembergroup', verifyToken, async (req,res)=>{
    const {groupId,selectUsers} = req.body;
    try {
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT * FROM groups WHERE groupId =?',[groupId])
        if(rows.length===0)
        {
            return res.status(200).json({status:'fail',message:"Group Not Exist!"})
        }
        const d = new Date();
        const formattedDate = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
        
       
        if(groupId)
        {
            selectUsers.map( async (user)=>{
                //console.log(user.value);
                await db.query("INSERT INTO group_members (groupId, userId,joinedAt) VALUES (?,?,?)", [groupId, user.value,formattedDate])
            })
            const totalMember = parseInt(rows[0].totalMember+selectUsers.length)
            await db.query("UPDATE groups set totalMember = ? WHERE groupId = ?",[totalMember,groupId])
        }
        
        return res.status(200).json({status:'success',message:"Member Added Successfully!"})
        
    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.get('/getuserselectedchat/:id/:selecteduserid', verifyToken, async (req,res)=>{
    try {
        let senderid  = req.params.id;
        let selecteduserid  = req.params.selecteduserid;
        //console.log(req.userId);
        if(senderid)
        {
            const decodeSenderid = atob(senderid)
            const decodeSelectedUserId = atob(selecteduserid)
            //console.log(decodeSenderid);

            const db = await connectToDatabase()
            //const [rows] = await db.query('SELECT * FROM messages WHERE (senderid =? or receiverId =?) and receiverId=?',[req.userId,req.userId,decodeSenderid])
            const [rows] = await db.query(`SELECT * FROM messages WHERE ((senderId = ${decodeSelectedUserId} AND receiverId = ${decodeSenderid}) OR (senderId = ${decodeSenderid} AND receiverId = ${decodeSelectedUserId})) AND groupId IS NULL `)
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

router.get('/getgroupselecteduserlist/:selecteduserid', verifyToken, async (req,res)=>{
    try {
        
        let selecteduserid  = req.params.selecteduserid;
        const decodeSelectedUserId = atob(selecteduserid)

        const db = await connectToDatabase()
        //const [rows] = await db.query(`SELECT groupId, groupName, upper(left(groupName,1)) as groupshortName FROM groups where createdBy = ${req.userId} ORDER BY groupId desc`)
        const [rows] = await db.query(`SELECT group_members.groupId, groups.groupName, groups.totalMember, groups.createdBy, upper(left(groups.groupName,1)) as groupshortName FROM group_members INNER JOIN groups ON groups.groupId = group_members.groupId WHERE group_members.userId = ${decodeSelectedUserId}`)
        if(rows.length===0)
        {
            return res.status(403).json({message:"Empty group list!"})
        }

        return res.status(200).json(rows)

    } catch (error) {
        res.status(500).json(error.message)
    }
})


router.get('/getinteractwithuserlist/:selecteduserid', verifyToken, async (req,res)=>{
    try {
        let selecteduserid  = req.params.selecteduserid;
        const decodeSelectedUserId = atob(selecteduserid)

        const db = await connectToDatabase()
        const [rows] = await db.query(`SELECT DISTINCT u.id as userId,u.name as userName,upper(left(u.name,1)) as usershortName FROM users u JOIN messages m ON (m.senderId = u.id OR m.receiverId = u.id) WHERE (m.senderId = ${decodeSelectedUserId} OR m.receiverId = ${decodeSelectedUserId}) AND m.groupId IS NULL AND m.receiverId IS NOT NULL AND u.id != ${decodeSelectedUserId}`)
        if(rows.length===0)
        {
            return res.status(403).json({message:"User data not Exist!"})
        }

        return res.status(200).json(rows)

    } catch (error) {
        res.status(500).json(error.message)
    }
})


export default router;