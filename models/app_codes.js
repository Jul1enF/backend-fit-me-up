const mongoose = require('mongoose')

const appCodeSchema = mongoose.Schema({
    name : String,
    code : String,
})

const AppCode = mongoose.model('app_codes', appCodeSchema)

module.exports = AppCode