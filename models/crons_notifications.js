const mongoose = require('mongoose')

const cronNotificationSchema = mongoose.Schema({
    cron_notification_number : Number,
    notification_title : String,
    notification_message : String,
    is_active : Boolean,
    minute : Array,
    hour : Array,
    day : Array,
    month : Array,
    cron_id : String,
})

const CronNotification = mongoose.model('crons_notifications', cronNotificationSchema)

module.exports = CronNotification