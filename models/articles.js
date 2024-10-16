const mongoose = require('mongoose')

const articleSchema = mongoose.Schema({
    title : String,
    sub_title : String,
    img_link : String,
    img_public_id : String,
    video_id : String,
    category : String,
    text : String,
    createdAt : Date,
    author : String,
})

const Article = mongoose.model('articles', articleSchema)
module.exports = Article