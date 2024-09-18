var express = require('express');
var router = express.Router();
const User = require('../models/users')
const { Expo } = require('expo-server-sdk')


router.post('/', async (req, res) => {
  try {

    const { firstname, push_token } = req.body

    const newUser = new User({
      firstname,
      push_token,
    })

    await newUser.save()

    res.json({ result: "local server" })
  }
  catch (error) {
    res.json({ error })
  }
});



// Route pour poster des notifs

router.post('/postNotif', async (req, res) => {
  try {

    const { postMessage } = req.body

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
        title: "Titre de la notif",
        body: postMessage,
      })
      }
    }


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

    // Vérification de la présence d'erreur dans les tickets de reçu (Google et Apple peuvent bloquer une app qui envoie des notifications pas reçues)


    // Tri des tickets pour ne garder que ceux qui ont franchi la première étape (envoi) et contiennent une ID

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


    // Extraction des ID des tickets contenant des informations supplémentaires (notamment si erreur)

    // Extraction des id
    let ticketsIdChunks = expo.chunkPushNotificationReceiptIds(ticketsWithId);

    // Lecture des infos des id
    for (let chunk of ticketsIdChunks) {
      try {
        let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        console.log("Receipts :", receipts);

        // Boucle juste pour remplacer par une variable le nom du champ (qui est une id qu'on ne connait pas) et pouvoir accéder à son contenu.
        for (let informations in receipts) {
          let { status, details } = receipts[informations]
          console.log("receipts informations :", receipts[informations])

          if (status === 'error') {
            console.log("ReceiptId error :", receipts[informations])
            if (details && details.error && !tokensToSuppress.some(e => e === details.expoPushToken)) {
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
        await User.updateOne({push_token : pushToken}, {push_token : ""})
      }
    }

    res.json({ tickets })
  }
  catch (error) {
    res.json({ error })
    console.log(error)
  }
});


module.exports = router;
