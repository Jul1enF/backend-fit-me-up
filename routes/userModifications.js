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


module.exports = router