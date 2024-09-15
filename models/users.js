const mongoose =require('mongoose')

const userSchema = mongoose.Schema({
    firstname : String,
    name : String,
    email : String,
    password : String,
    inscription_date :Date,
    is_verified : Boolean,
    is_admin : {type : Boolean, default : false},
    token : String,
    bookmarks : Object,
})

const User = mongoose.model('users', userSchema)

module.exports = User