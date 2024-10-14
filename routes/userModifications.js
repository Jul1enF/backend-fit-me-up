var express = require('express')
var router = express.Router()

const jwt = require('jsonwebtoken')
const secretToken = process.env.SECRET_TOKEN
const User = require('../models/users')


// Route pour modifier le push token d'un utilisateur

router.put('/changePushToken', async (req, res) => {
    try {
        const { token, push_token } = req.body
        const decryptedToken = jwt.verify(token, secretToken)

        const userData = await User.findOne({ token : decryptedToken.token })

        if (!userData) {
            res.json({ result: false, error: "Token de connexion non valide !" })
        }
        else {
            userData.push_token = push_token

            await userData.save()

            res.json({ result: true })
        }
    } catch (err) { res.json({ err }) }
})


// Route pour ajouter un bookmark

router.put('/addBookmark', async (req, res) =>{
    try {
        const { _id, jwtToken } = req.body

        const decryptedToken = jwt.verify(jwtToken, secretToken)

        const userData = await User.findOne({ token : decryptedToken.token })

        if (!userData) {
            res.json({ result: false, error: "Problème de connexion, merci de réessayer après vous être reconnecté." })
        }
        else {
            userData.bookmarks.push(_id)

            await userData.save()

            res.json({ result: true })
        }

    } catch (err){
        console.log(err)
        res.json({result : false, err, error : "Problème de connexion, merci de réessayer après vous être reconnecté."})
    }
})

// Route pour supprimer un bookmark

router.put('/removeBookmark', async (req, res) =>{
    try {
        const { _id, jwtToken } = req.body

        const decryptedToken = jwt.verify(jwtToken, secretToken)

        const userData = await User.findOne({ token : decryptedToken.token })

        if (!userData) {
            res.json({ result: false,  error: "Problème de connexion, merci de réessayer après vous être reconnecté." })
        }
        else {
            userData.bookmarks = userData.bookmarks.filter(e=> e.toString() !==_id)

            await userData.save()

            res.json({ result: true })
        }

    } catch (err){
        console.log(err)
        res.json({result : false, err,  error: "Problème de connexion, merci de réessayer après vous être reconnecté." })
    }
})

module.exports = router