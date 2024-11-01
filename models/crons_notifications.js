const mongoose = require('mongoose')

const cronNotificationSchema = mongoose.Schema({
    cron_notification_number : Number,
    notification_title : String,
    notification_message : String,
    is_active : Boolean,
    minute : String,
    hour : String,
    day : String,
    month : String,
    cron_id : String,
})

const CronNotification = mongoose.model('crons_notifications', cronNotificationSchema)

module.exports = CronNotification