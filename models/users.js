const mongoose =require('mongoose')

const userSchema = mongoose.Schema({
    firstname : String,
    name : String,
    email : String,
    password : String,
    inscription_date :Date,
    is_admin : {type : Boolean, default : false},
    is_allowed : {type : Boolean, default : true},
    coach : String,
    token : String,
    push_token : String,
    bookmarks : [{ type: mongoose.Schema.Types.ObjectId, ref: 'articles' }],
})

const User = mongoose.model('users', userSchema)

module.exports = User