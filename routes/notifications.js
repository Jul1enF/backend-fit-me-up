var express = require('express');
var router = express.Router();

const { Expo } = require('expo-server-sdk')

const User = require('../models/users')
const CronNotification = require("../models/crons_notifications")

const jwt = require('jsonwebtoken')
const secretToken = process.env.SECRET_TOKEN

const cronKey = process.env.CRON_KEY

const mongoose = require('mongoose')
const connectionString = process.env.CONNECTION_STRING



// Fonction pour envoyer une notification

const sendNotification = async (title, message) => {

  let expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
    useFcmV1: true,
    maxConcurrentRequests : 10,
  });

  const allUsers = await User.find()

  let messages = []

  for (let user of allUsers) {
    if (!Expo.isExpoPushToken(user.push_token)) {
      console.log(`Push token ${user.push_token} is not a valid Expo push token`);
    }
    else {
      messages.push({
        to: user.push_token,
        sound: 'default',
        title,
        body: message,
        priority : 'high',
        channelId : 'boost-up',
        ttl: 604800,
        data : {
          collapse : false,
        }
      })
    }
  }

  // Création de "morceaux" à envoyer à expo push notif (méthode la plus efficace)

  let chunks = expo.chunkPushNotifications(messages);
  let tickets = [];

  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk)
      console.log("Recivedticket :", ticketChunk)
      tickets.push(...ticketChunk)
    } catch (error) {
      console.log(error);
    }
  }

  // Vérification de la présence d'erreur dans les tickets de reçu 
  // (Google et Apple peuvent bloquer une app qui envoie 
  // des notifications pas reçues)


  // Tri des tickets pour ne garder que ceux qui ont franchi 
  // la première étape (envoi) et contiennent une ID

  let ticketsWithId = [];

  let tokensToSuppress = []

  for (let ticket of tickets) {
    if (ticket.status === 'ok') {
      ticketsWithId.push(ticket.id);
    }
    else {
      console.log("Bad ticket : ", ticket)
      tokensToSuppress.push(ticket.details.expoPushToken)
    }
  }


  // Extraction des ID des tickets contenant des informations 
  // supplémentaires (notamment si erreur)

  let ticketsWithIdChunks = expo.chunkPushNotificationReceiptIds(ticketsWithId);

  for (let chunk of ticketsWithIdChunks) {
    try {
      let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      console.log("Receipts :", receipts);

      // Boucle juste pour remplacer par une variable le nom du champ 
      // (qui est une id qu'on ne connait pas) et pouvoir accéder à son contenu.

      for (let receiptId in receipts) {
        let { status, details } = receipts[receiptId]

        if (status === 'error') {
          console.log("ReceiptId error :", receipts[informations])

          if (details && details.error &&
            !tokensToSuppress.some(e => e === details.expoPushToken)) {
            tokensToSuppress.push(details.expoPushToken)
          }
        }
      }

    } catch (error) {
      console.log(error);
    }
  }
  // Suppression des push tokens à problèmes
  if (tokensToSuppress.length > 0) {
    for (let pushToken of tokensToSuppress) {
      await User.updateOne({ push_token: pushToken }, { push_token: "" })
    }
  }

}



// Route pour envoyer une notification

router.put('/send-notification', async (req, res) => {

  try {
    await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })

    const { title, message, jwtToken } = req.body

    const decryptedToken = jwt.verify(jwtToken, secretToken)
    let user = await User.findOne({ token: decryptedToken.token })
  
    // Vérification que l'utilisateur postant est bien admin
    if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé ou non autorisé. Essayez en vous reconnectant.' }) }

    await sendNotification(title, message)

    res.json({ result: true })

  } catch (err) {
    console.log(err)
    res.json({ result: false, err })
  }
})




// Route pour enregistrer une cron notification

router.put('/register-cron-notification', async (req, res) => {
  try {
    await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })


    const { notification_title, notification_message, is_active, minute, hour, day, month, jwtToken } = req.body


    const decryptedToken = jwt.verify(jwtToken, secretToken)
    let user = await User.findOne({ token: decryptedToken.token })
  
    // Vérification que l'utilisateur postant est bien admin
    if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé ou non autorisé. Essayez en vous reconnectant.' }) }
  

    // Enregistrement de la nouvelle cron notification

    const newCron = new CronNotification({
      notification_title,
      notification_message,
      is_active,
      minute,
      hour,
      day,
      month,
    })

    const cronSaved = await newCron.save()

    // Création de l'objet au format demandé par cron-job.org pour l'enregistrer chez ceux ci

    const id = cronSaved._id.toString()

    const job = {
      url: `https://backend-fit-me-up.vercel.app/notifications/send-cron-notification/${id}`,
      enabled: is_active,
      saveResponses: true,
      schedule: {
        timezone: "Europe/Paris",
        expiresAt: 0,
        hours: hour,
        mdays: day,
        minutes: minute,
        months: month,
        wdays: [-1]
      },
      requestMethod: 4,
    }

    console.log("JOB :", job)

    const response = await fetch(`https://api.cron-job.org/jobs`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronKey}`
      },
      body: JSON.stringify({
        job,
      })
    })

    const data = await response.json()
    console.log("DATA :", data)

    cronSaved.cron_id = data.jobId

    const cronSavedAgain = await cronSaved.save()

    res.json({ result: true, cronSavedAgain })

  } catch (err) {
    console.log(err)
    res.json({ result: false, err })
  }
})




// Route pour poster une cron notification (appelée par cron-job.org)

router.put('/send-cron-notification/:_id', async (req, res) => {

  try {
    await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })

    const { _id } = req.params

    const notification = await CronNotification.findOne({ _id })

    await sendNotification(notification.notification_title, notification.notification_message)

    res.json({ result: true })

  } catch (err) {
    res.json({ result: false })
    console.log(err)
  }


})




// Route pour modifier une cron notification


router.put('/modify-cron-notification', async (req, res) => {
  try {
    await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })


    const { notification_title, notification_message, is_active, minute, hour, day, month, _id, cron_id, jwtToken } = req.body


    const decryptedToken = jwt.verify(jwtToken, secretToken)
    let user = await User.findOne({ token: decryptedToken.token })
  
    // Vérification que l'utilisateur postant est bien admin
    if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé ou non autorisé. Essayez en vous reconnectant.' }) }
  

    // Recherche de la cron notification à modifier
    const cronNotif = await CronNotification.findOne({ _id })


    // Enregistrement de la nouvelle cron notification
    cronNotif.notification_title = notification_title
    cronNotif.notification_message = notification_message
    cronNotif.is_active = is_active
    cronNotif.minute = minute
    cronNotif.hour = hour
    cronNotif.day = day
    cronNotif.month = month

    const cronSaved = await cronNotif.save()


    // Mise en forme de l'object à envoyer à cron-job.org

    const job = {
      url: `https://backend-fit-me-up.vercel.app/notifications/send-cron-notification/${_id}`,
      enabled: is_active,
      saveResponses: true,
      schedule: {
        timezone: "Europe/Paris",
        expiresAt: 0,
        hours: hour,
        mdays: day,
        minutes: minute,
        months: month,
        wdays: [-1]
      },
      requestMethod: 4,
    }

    const response = await fetch(`https://api.cron-job.org/jobs/${cron_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronKey}`
      },
      body: JSON.stringify({
        job,
      })
    })

    const data = await response.json()
    console.log("DATA MODIFY :", data)

    res.json({ result: true, cronSaved })

  } catch (err) {
    console.log(err)
    res.json({ result: false, err })
  }
})




// Route pour supprimer une cron notification

router.delete('/delete-cron-notification/:cron_id/:jwtToken', async (req, res) => {

  await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })


  let { cron_id, jwtToken } = req.params

  const decryptedToken = jwt.verify(jwtToken, secretToken)
  let user = await User.findOne({ token: decryptedToken.token })

  // Vérification que l'utilisateur postant est bien admin
  if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé ou non autorisé. Essayez en vous reconnectant.' }) }


  cron_id = Number(cron_id)

  const answer = await CronNotification.deleteOne({cron_id})

  console.log(answer)

  if (answer.deletedCount !== 1){
    res.json({result : false, error : "Problème de connexion à la base de donnée. Merci de réassayer après avoir relancé l'appli."})
    return
  }

  const response  = await fetch(`https://api.cron-job.org/jobs/${cron_id}`, { 
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cronKey}`
    }
  })

  const data = await response.json()

  console.log("DATA DELETE :", data)

  res.json({result : true})

})






// Route pour télécharger la liste des crons notifications

router.get('/get-crons-notifications', async (req, res) => {
  try {
    await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })

    const data = await CronNotification.find()

    if (data.length > 1) {
      res.json({ result: true, cronsNotifications: data })
    }
    else {
      console.log(data)
      res.json({ result: false, error: "Pas de notifications programmées en bdd" })
    }

  } catch (err) {
    console.log(err)
    res.json({ result: false, err })
  }
})


module.exports = router;
