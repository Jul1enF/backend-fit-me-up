var express = require('express');
var router = express.Router();

const { Expo } = require('expo-server-sdk')

const User = require('../models/users')
const CronNotification = require("../models/crons_notifications")

const cronKey = process.env.CRON_KEY

// Fonction pour envoyer une notification

const sendNotification = async (title, message) => {

  let expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
    useFcmV1: true,
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

    const { title, message } = req.body

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
    const { notification_title, notification_message, is_active, minute, hour, day, month } = req.body

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

     // Si la notif est active, création de l'objet au format demandé par cron-job.org pour l'enregistrer chez ceux ci
    
     if (is_active){
      const id = cronSaved._id.toString()

      const job = {
        url : `https://backend-fit-me-up.vercel.app/notifications/send-cron-notification/${id}`,
        enabled : is_active,
        saveResponses : true,
        schedule : {
          timezone : "Europe/Paris",
          expiresAt : 0,
          hours : hour,
          mdays : day,
          minutes : minute,
          months : month,
        }
      }

console.log("JOB :",job)

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

    const crondSavedAgain = await cronSaved.save()

    console.log("FINAL CRON SAVE :", crondSavedAgain)
  
    }

    res.json({ result: true })

  } catch (err) {
    console.log(err)
    res.json({ result: false, err })
  }
})




// Route pour poster une cron notification (appelée par cron-job.org)

router.put('/send-cron-notification/:_id', async (req, res) => {

try {const {_id} = req.params

const notification = await CronNotification.findOne({_id})

console.log("CRON JOB DONE !")
console.log("BDD CRON :", notification)

}catch (err){
res.json({result : false})
console.log(err)
}


})

// Route pour modifier les crons notifications


// PENSER À VÉRIFIER SI LA CRON NOTIF EN BDD À UNE CRON-ID

router.put('/modify-cron-notification', async (req, res) => {
  try {
    const { cron_notification_number, notification_title, notification_message, is_active, minute, hour, day, month } = req.body

    // Recherche de la cron notification à modifier
    const cronNotif = await CronNotification.findOne({ cron_notification_number })


    // Arrêt de la précédente exécution de la cron notif ciblée si elle était active
    cronNotif.is_active && cronJobs[cron_notification_number - 1].cron.stop()

    // Enregistrement de la nouvelle cron notification
    cronNotif.notification_title = notification_title
    cronNotif.notification_message = notification_message
    cronNotif.is_active = is_active
    cronNotif.minute = minute
    cronNotif.hour = hour
    cronNotif.day = day
    cronNotif.month = month

    await cronNotif.save()


    // Return si la modification désactive la cron notification
    if (!is_active) {
      res.json({ result: true })
      return
    }

    // Sinon reprogrammation de celle ci
    cronJobs[cron_notification_number - 1].cron = cron.schedule(

      // Réglage date d'envoie(s)
      `${minute} ${hour} ${day} ${month} *`, () => {
        // Fonction pour envoyer notifs
        sendNotification(notification_title, notification_message)
      },
      { scheduled: false, timezone: "Europe/Paris" })

    cronJobs[cron_notification_number - 1].cron.start()


    res.json({ result: true })

  } catch (err) {
    console.log(err)
    res.json({ result: false, err })
  }
})




// Route pour télécharger la liste des crons notifications

router.get('/get-crons-notifications', async (req, res) => {
  try {

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





// Route pour enregistrer une nouvelle cron notif (via ThunderClient)


// router.post('/post', async (req, res)=>{
//   const { cron_notification_number, notification_title, notification_message, is_active, minute, hour, day, month } = req.body

// const newCronNotification = new CronNotification({
//   cron_notification_number,
//   notification_title,
//   notification_message,
//   is_active,
//   minute,
//   hour,
//   day,
//   month
// })

// await newCronNotification.save()

// res.json({result : true})

// })




// Initialisation des crons jobs à l'intérieur d'un objet dans un scope accessible à tous


// let cronJobs = []

// for (let i = 0; i < 10; i++) {

//   cronJobs.push({
//     name: `task ${i + 1}`,
//     cron: cron.schedule("* * * * *", () => {
//       console.log(`task ${i + 1}`);
//     }, { scheduled: false })
//   })

// }


// const { AsyncLocalStorage } = require('node:async_hooks');

// const storage = new AsyncLocalStorage()

// storage.enterWith(1)

// console.log("storage 1 :", storage.getStore())

// storage.enterWith(storage.getStore()+1)

// console.log("storage 2 :",storage.getStore())

// Route pour récupérer en bdd les crons notifs puis fetch pour appeler celle ci et régler les crons jobs

// app.locals.cronJobs = []


// router.get('/setCrons', async (req, res) => {

//   console.log("DB Fetch begins")
//   const cronNotifs = await CronNotification.find()
//   console.log("DB Fetch previously for crons")


//   for (let i = 0; i < cronNotifs.length; i++) {

//     app.locals.cronJobs.push({
//       name : `cron ${i+1}`,
//       cron : cron.schedule(

//         // Réglage date d'envoie(s)
//         `${cronNotifs[i].minute} ${cronNotifs[i].hour} ${cronNotifs[i].day} ${cronNotifs[i].month} *`, () => {

//         // Fonction pour envoyer notifs
//         sendNotification(cronNotifs[i].notification_title, cronNotifs[i].notification_message)

//       }, { scheduled: false, timezone: "Europe/Paris" })
//     })
//   }


  // for (let i = 0; i < cronNotifs.length; i++) {

  //   req.app.locals.cronJobs = [...app.locals.cronJobs, {
  //     name : `cron ${i+1}`,
  //     cron : cron.schedule(

  //       // Réglage date d'envoie(s)
  //       `${cronNotifs[i].minute} ${cronNotifs[i].hour} ${cronNotifs[i].day} ${cronNotifs[i].month} *`, () => {

  //       // Fonction pour envoyer notifs
  //       sendNotification(cronNotifs[i].notification_title, cronNotifs[i].notification_message)

  //     }, { scheduled: false, timezone: "Europe/Paris" })
  //   }] 
  // }

//   console.log("APP.LOCALS 3:", app.locals.cronJobs)
//  res.json({result : true})
  // res.json({ result: true, cronNotifs })

// })

// console.log("APP.LOCALS 1:", app.locals.cronJobs)





// if (app.locals.cronJobs.length == 0){


//   fetch(`${process.env.BACK_ADDRESS}/notifications/setCrons`)
//   .then(response => response.json())
//   .then(data => {
//   console.log(data)


      // if (data.cronNotifs[i].is_active) {

      //   cronJobs[i].cron = cron.schedule(

      //     // Réglage date d'envoie(s)
      //     `${data.cronNotifs[i].minute} ${data.cronNotifs[i].hour} ${data.cronNotifs[i].day} ${data.cronNotifs[i].month} *`, () => {

      //     // Fonction pour envoyer notifs
      //     sendNotification(data.cronNotifs[i].notification_title, data.cronNotifs[i].notification_message)

      //   }, { scheduled: false, timezone: "Europe/Paris" })

      //   cronJobs[i].cron.start()
      // }

//   })

  
// }

// console.log("APP.LOCALS 2:", app.locals.cronJobs)


// fetch(`${process.env.BACK_ADDRESS}/notifications/setCrons`)
//   .then(response => response.json())
//   .then(data => {
//     console.log(data)
//     for (let i = 0; i < data.cronNotifs.length; i++) {

//       if (data.cronNotifs[i].is_active) {

//         cronJobs[i].cron = cron.schedule(

//           // Réglage date d'envoie(s)
//           `${data.cronNotifs[i].minute} ${data.cronNotifs[i].hour} ${data.cronNotifs[i].day} ${data.cronNotifs[i].month} *`, () => {

//           // Fonction pour envoyer notifs
//           sendNotification(data.cronNotifs[i].notification_title, data.cronNotifs[i].notification_message)

//         }, { scheduled: false, timezone: "Europe/Paris" })

//         cronJobs[i].cron.start()
//       }
//     }
//   })
