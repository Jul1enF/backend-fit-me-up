const mongoose = require('mongoose')
const connectionString = process.env.CONNECTION_STRING

const connect = async ()=> {
    try {
        await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })
         console.log('Database connected')
     }catch (error){
         console.log(error)
     }

}

connect()
