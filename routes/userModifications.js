var express = require('express')
var router = express.Router()

const jwt = require('jsonwebtoken')
const secretToken = process.env.SECRET_TOKEN
const bcrypt = require('bcrypt')
const User = require('../models/users')




// Route pour modifier le push token d'un utilisateur

router.put('/changePushToken', async (req, res) => {
    try {
        const { jwtToken, push_token } = req.body

        const decryptedToken = jwt.verify(jwtToken, secretToken)

        const userData = await User.findOne({ token: decryptedToken.token })

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

router.put('/addBookmark', async (req, res) => {
    try {
        const { _id, jwtToken } = req.body

        const decryptedToken = jwt.verify(jwtToken, secretToken)

        const userData = await User.findOne({ token: decryptedToken.token })

        if (!userData) {
            res.json({ result: false, error: "Problème de connexion, merci de réessayer après vous être reconnecté." })
        }
        else {
            userData.bookmarks.push(_id)

            await userData.save()

            res.json({ result: true })
        }

    } catch (err) {
        console.log(err)
        res.json({ result: false, err, error: "Problème de connexion, merci de réessayer après vous être reconnecté." })
    }
})



// Route pour supprimer un bookmark

router.put('/removeBookmark', async (req, res) => {
    try {
        const { _id, jwtToken } = req.body

        const decryptedToken = jwt.verify(jwtToken, secretToken)

        const userData = await User.findOne({ token: decryptedToken.token })

        if (!userData) {
            res.json({ result: false, error: "Problème de connexion, merci de réessayer après vous être reconnecté." })
        }
        else {
            userData.bookmarks = userData.bookmarks.filter(e => e.toString() !== _id)

            await userData.save()

            res.json({ result: true })
        }

    } catch (err) {
        console.log(err)
        res.json({ result: false, err, error: "Problème de connexion, merci de réessayer après vous être reconnecté." })
    }
})



// Route pour changer le statut allowed d'un user

router.put('/toggle-allowed', async (req, res) => {

    try {
        const { jwtToken, _id } = req.body

        const decryptedToken = jwt.verify(jwtToken, secretToken)
        let user = await User.findOne({ token: decryptedToken.token })

        // Vérification que l'utilisateur postant est bien admin
        if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé ou non autorisé. Essayez en vous reconnectant.' }) }

        const data = await User.findOne({ _id })

        data.is_allowed = !data.is_allowed

        await data.save()

        res.json({ result: true })

    } catch (err) {
        console.log(err)
        res.json({ result: false, err })
    }
})



// Route pour changer le statut admin d'un user

router.put('/toggle-admin', async (req, res) => {

    try {
        const { jwtToken, _id } = req.body

        const decryptedToken = jwt.verify(jwtToken, secretToken)
        let user = await User.findOne({ token: decryptedToken.token })

        // Vérification que l'utilisateur postant est bien admin
        if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé ou non autorisé. Essayez en vous reconnectant.' }) }

        const data = await User.findOne({ _id })

        data.is_admin = !data.is_admin

        await data.save()

        res.json({ result: true })

    } catch (err) {
        console.log(err)
        res.json({ result: false, err })
    }
})


// Route pour modifier les informations d'un utilisateur

router.put('/modify-user', async (req, res) => {
    try {

        const { name, firstname, email, oldPassword, password, jwtToken } = req.body

        const decryptedToken = jwt.verify(jwtToken, secretToken)
        let user = await User.findOne({ token: decryptedToken.token })

        // Vérification que l'utilisateur postant est bien admin
        if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé ou non autorisé. Essayez en vous reconnectant.' }) }

        user.name = name
        user.firstname = firstname
        user.email = email

        if (oldPassword && !bcrypt.compareSync(oldPassword, user.password)) {
            res.json({ result: false, error: "Ancien mot de passe incorrect !" })
            return
        }

        if (password) {
            const hash = bcrypt.hashSync(password, 10)
            user.password = hash
        }

        await user.save()

        res.json({ result: true })

    }catch (err) {
        console.log(err)
        res.json({ result: false, err })
    }

})


module.exports = router