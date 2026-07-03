import customerModel from "../models/Customers.js";
import employeesModel from "../models/Employees.js";
import bcryptjs from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";
import {config} from "../config.js"

const logincontroller = {};

//post - agregar
          
logincontroller.login = async (req, res) => {
    const {email, password} = req.body; //req.body = lo que le pedimos al frontend
    console.log({message: "valores"})

try {
let userFound;
let userType;

if(email === config.admin.ADMIN_USERNAME && password === config.admin.ADMIN_PASSWORD){
     userType = "admin"
userFound = {_id:"admin"}

   

}else {
userFound = await employeesModel.findOne({email})
    userType = "employee"

    if (!userFound){
        userFound = await customerModel.findOne({email})
        userType = "customer"
    
    }
}

if(!userFound){
    return res.json ({message: "User not found "})
}

if(userType !== "admin"){
if(userFound.timeOut>Date.now()){
const minutosRestantes = Math.ceil(userFound.timeOut - Date.now()/60000)
res.status(403).json({message: "cuenta bloqueada" + minutosRestantes})

} 
  }

if(userType !== "admin"){
    const isMatch = await bcryptjs.compare(password, userFound.password)
    if (!isMatch){

        //contador de intentos fallidos
        userFound.loginAttemps = userFound.loginAttemps + 1

        if(userFound.loginAttemps >=3){
            userFound.timeOut = Date.now + 5*60*1000

userFound.loginAttemps = 0

            await userType.save()
            res.status(403).json({message: "cuenta bloqueada"})
        }

await userFound.save()
        res.json({message: "invalid password"})
    }
    userFound.loginAttemps = 0
    userFound.timeOut = null
    await userFound.save()
}

jsonwebtoken.sign (
    {id: userFound._id, userType},

    config.jwt.secret,

{expiresIn:config.jwt.expiresIn},

(error, token)=> {
    if(error) console.log ("error" + error)
        res.cookie("authToken", token)
    res.json({message: "login successful    "})

}


)

}catch(error){
    console.log("error"+error)


}
}

 export default logincontroller; 