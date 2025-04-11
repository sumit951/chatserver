import express from "express";
import { connectToDatabase } from "../lib/db.js";
//import bcrypt from 'bcrypt';
import md5 from 'md5';
import jwt from "jsonwebtoken";
import { SendMailClient } from "zeptomail";

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
        return res.status(500).json({message:error.message})
    }  
}

router.post('/adduser', verifyToken, async (req,res)=>{
    const {name,email,employeeId,officeName,cityName,userType,chatDeleteInDays} = req.body;
    try {
        const url = "api.zeptomail.com/";
        const token = process.env.ZEPTO_KEY;    

        let client = new SendMailClient({url, token});
        const userId =  3
        const verifyCode =  Math.floor(100000 + Math.random() * 900000);

        client.sendMail({
            "from": 
            {
                "address": "noreply@rapidcollaborate.in",
                "name": "Rapid Collaborate"
            },
            "to": 
            [
                {
                "email_address": 
                    {
                        "address": email,
                        "name": name
                    }
                }
            ],
            "reply_to": 
            [
                {
                    "address": "",
                    "name": ""
                } 
            ],
            "subject": "Create Password || Rapid Collaborate",
            "textbody": "Easy to do from anywhere, with  Node.js",
            "htmlbody": "Hi "+name+"</br></br> Verify URL <a href='https://rapidcollaborate.in/chat-app/createpassword/"+userId+"/"+verifyCode+"'> Click Here </a></br></br> Thanks</br> Rapid Collaborate",
            "cc": 
            [
                {
                "email_address": 
                    {
                        "address": "",
                        "name": ""
                    }
                }
            ],
            "bcc": 
            [
                {
                "email_address": 
                    {
                        "address": "",
                        "name": ""
                    }
                }
            ]
        }).then((resp) => console.log(resp)).catch((error) => console.log(error));
        
        //return false;
        
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT * FROM users WHERE email =?',[email])
        if(rows.length>0)
        {
            
            return res.status(200).json({status:'fail',message:"User Already Exist!"})
        }
        //const userId =  rows[0].id    
        //const password = 'hjksd798jhj3';
        const d = new Date();
        const formattedDate = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
        
        //const hashPassword = await bcrypt.hash(password,10)
        //const hashPassword = await md5(password)
        //await db.query("INSERT INTO users (name, email,employeeId,password,decryptPassword,addedon) VALUES (?,?,?,?,?,?)", [name, email, employeeId, hashPassword,password,formattedDate])
        await db.query("INSERT INTO users (name, email,userType,employeeId,officeName,cityName,verify,addedon,chatDeleteInDays) VALUES (?,?,?,?,?,?,?,?,?)", [name, email, userType, employeeId,officeName,cityName,verifyCode,formattedDate,chatDeleteInDays])
        return res.status(200).json({status:'success',message:"User Added Successfully!"})

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.get('/getalluser', verifyToken, async (req,res)=>{
    try {
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT *,DATE_FORMAT(addedon, "%Y-%m-%d %H:%i:%s") AS addedon FROM users where userType !="ADMIN" ORDER BY id desc')
        if(rows.length===0)
        {
            return res.status(403).json({message:"User data not Exist!"})
        }

        return res.status(200).json(rows)

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.get('/getadmininfo/:id', verifyToken, async (req,res)=>{
    try {
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT *,DATE_FORMAT(addedon, "%d-%m-%Y %H:%i:%s") AS addedon FROM users where id ="'+req.params.id+'"')
        if(rows.length===0)
        {
            return res.status(403).json({message:"User data not Exist!"})
        }

        return res.status(200).json(rows)

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.put('/updateadmininfo', verifyToken, async (req,res)=>{
    const {id,name,email,employeeId,officeName,cityName,password,chatDeleteInDays} = req.body;
    console.log(chatDeleteInDays);
    try {
        if(id && email)
        {
            //console.log(req.body);
            const db = await connectToDatabase()
            const [rows] = await db.query('SELECT * FROM users WHERE id =?',[id])
            if(rows.length===0)
            {
                return res.status(200).json({status:'fail',message:"User not Exist!"})
            }

            //const password = 'hjksd798jhj3';
            //const d = new Date();
            //const formattedDate = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
            if(password!=null)
            {
                //const hashPassword = await bcrypt.hash(password,10)        
                const hashPassword = await md5(password)
                await db.query("UPDATE users set name =?, email =?, employeeId =?, officeName =?, cityName =?, password = ?, decryptPassword = ?, chatDeleteInDays = ? WHERE id = ?", [name,email,employeeId,officeName,cityName,hashPassword,password,chatDeleteInDays,id])
                return res.status(200).json({status:'success',message:"Info. Updated Successfully!"}) 
            }
            else
            {      
                await db.query("UPDATE users set name =?, email =?, employeeId =?, officeName =?, cityName =?, chatDeleteInDays = ?  WHERE id = ?",[name,email,employeeId,officeName,cityName,chatDeleteInDays,id])
                return res.status(200).json({status:'success',message:"Info. Updated Successfully!"})
            }
        }
        else
        {
            return res.status(403).json({message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.delete('/deleteuser/:id', verifyToken, async (req,res)=>{
    try {
        let id  = req.params.id;
        if(id)
        {
            const db = await connectToDatabase()
            await db.query("DELETE FROM users WHERE id != 1 and id = ?", [id])
            return res.status(200).json({status:'success',message:"Info. Deleted Successfully!"}) 
        }
        else
        {
            return res.status(403).json({status:'fail',message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.put('/updatestatus', async (req,res)=>{
    const {id,status} = req.body;
    try {
        if(id && status)
        {
            //console.log(req.body);
            const db = await connectToDatabase()
            const [rows] = await db.query('SELECT * FROM users WHERE id =?',[id])
            if(rows.length===0)
            {
                return res.status(403).json({message:"User not Exist!"})
            }
            
            await db.query("UPDATE users set status = ? WHERE id = ?",[status,id])
            return res.status(200).json({status:'success',message:"Status Changed Successfully!"}) 
        }
        else
        {
            return res.status(403).json({status:'success',message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.get('/getactivealluser', verifyToken, async (req,res)=>{
    try {
        const db = await connectToDatabase()
        const [rows] = await db.query('SELECT id as userId,name as userName,upper(left(name,1)) as usershortName, officeName, cityName, userType FROM users where status ="Active" ORDER BY id desc')
        if(rows.length===0)
        {
            return res.status(403).json({message:"User data not Exist!"})
        }

        return res.status(200).json(rows)

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.get('/getactiveallusergroup/:searchParam', verifyToken, async (req,res)=>{
    try {
        //console.log(req.params.searchParam);
        const searchParam = req.params.searchParam
        const db = await connectToDatabase()
        const [rows] = await db.query(`SELECT users.id as userId,users.name as userName, users.email as userEmail ,upper(left(users.name,1)) as usershortName, users.userType , COUNT(ug.groupId) AS groupCount FROM users LEFT JOIN group_members ug ON users.id = ug.userId where users.status ="Active" and (users.name LIKE "%${searchParam}%" or users.email LIKE "%${searchParam}%" ) GROUP BY users.id ORDER BY users.id desc`)
        if(rows.length===0)
        {
            return res.status(403).json({message:"User data not Exist!"})
        }

        return res.status(200).json(rows)

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.put('/updatesetting', verifyToken, async (req,res)=>{
    const {chatBusyDndstatus,chatBusyDndTime} = req.body;
    //console.log(req.body);
    
    try {
        if(chatBusyDndstatus && chatBusyDndTime)
        {
            //console.log(req.body);
            const db = await connectToDatabase()
            const [rows] = await db.query('SELECT * FROM users WHERE id =?',[req.userId])
            if(rows.length===0)
            {
                return res.status(403).json({message:"User not Exist!"})
            }
            const d = new Date();
            d.setMinutes(d.getMinutes() + chatBusyDndTime);
            const BusyDndTime = parseInt(chatBusyDndTime)
            const formattedDate = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
            await db.query("UPDATE users set chatStatus = ?, chatBusyDndTime = ?, chatBusyDndExpiredon = ? WHERE id = ?",[chatBusyDndstatus,BusyDndTime,formattedDate,req.userId])
            return res.status(200).json({status:'success',message:"Setting Info. Changed Successfully!"}) 
        }
        else
        {
            return res.status(403).json({status:'success',message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.put('/updatesettingtoactive', verifyToken, async (req,res)=>{
    const {chatBusyDndstatus,chatBusyDndTime} = req.body;
    //console.log(req.body);
    
    try {
        if(req.userId)
        {
            //console.log(req.body);
            const db = await connectToDatabase()
            const [rows] = await db.query('SELECT * FROM users WHERE id =?',[req.userId])
            if(rows.length===0)
            {
                return res.status(403).json({message:"User not Exist!"})
            }

            await db.query("UPDATE users set chatStatus = ?, chatBusyDndTime = ?, chatBusyDndExpiredon = ? WHERE id = ?",['Active',null,null,req.userId])
            return res.status(200).json({status:'success',message:"Setting Info. Changed Successfully!"}) 
        }
        else
        {
            return res.status(403).json({status:'success',message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})


router.get('/getaddmemberrequest', verifyToken, async (req,res)=>{
    try {
        //console.log(req.params.searchParam);
        const searchParam = req.params.searchParam
        const db = await connectToDatabase()
        const [rows] = await db.query(`SELECT gmr.requestId, gmr.groupId, gmr.requestSts, gmr.requestNumber, g.groupName, g.allowedMember, u.name, u.email, gmr.addedOn AS request_created_at FROM groupmemberrequest gmr JOIN groups g ON gmr.groupId = g.groupId JOIN users u ON gmr.userId = u.id ORDER BY gmr.addedOn DESC`)
        if(rows.length===0)
        {
            return res.status(403).json({message:"Request data not Exist!"})
        }

        return res.status(200).json(rows)

    } catch (error) {
        res.status(500).json(error.message)
    }
})

router.put('/updatestatusaddmemberreq', async (req,res)=>{
    const {id,status,groupId,updatedreqnumber} = req.body;
    try {
        if(id && status && groupId)
        {
            //console.log(req.body);
            const db = await connectToDatabase()
            const [rows] = await db.query('SELECT * FROM groups WHERE groupId =?',[groupId])
            if(rows.length===0)
            {
                return res.status(403).json({message:"Group not Exist!"})
            }
            
            await db.query("UPDATE groupmemberrequest set requestSts = ? WHERE requestId = ?",[status,id])
            if(status=='Approved')
            {
                await db.query("UPDATE groups set allowedMember = ? WHERE groupId = ?",[updatedreqnumber,groupId])
                return res.status(200).json({status:'success',message:"Request Approved Successfully!"})
            }

            return res.status(200).json({status:'success',message:"Request Rejected Successfully!"}) 
        }
        else
        {
            return res.status(403).json({status:'success',message:"Invalid Userid!"})
        }

    } catch (error) {
        res.status(500).json(error.message)
    }
})

export default router;