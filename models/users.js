const mongoose =require('mongoose')

const userSchema = mongoose.Schema({
    firstname : String,
    name : String,
    email : String,
    password : String,
    inscription_date :Date,
    is_verified : Boolean,
    is_admin : {type : Boolean, default : true},
    is_allowed : {type : Boolean, default : true},
    token : String,
    push_token : String,
    bookmarks : [{ type: mongoose.Schema.Types.ObjectId, ref: 'articles' }],
})

const User = mongoose.model('users', userSchema)

module.exports = User