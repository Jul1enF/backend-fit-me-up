var express = require('express');
var router = express.Router();
const User = require('../models/users')
const AppCode = require("../models/app_codes")

const mongoose = require('mongoose')
const connectionString = process.env.CONNECTION_STRING


const bcrypt = require('bcrypt')
const uid2 = require('uid2')
const jwt = require('jsonwebtoken')
const secretToken = process.env.SECRET_TOKEN

const { Expo } = require('expo-server-sdk')



// Route signup pour s'inscrire

router.put('/signup', async (req, res) => {
  try {
    const { firstname, name, email, password, appCode, coach } = req.body

    await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })

    // Vérification que le code l'app est valide
    const checkCode = await AppCode.findOne({ code: appCode })
    console.log("CHECK CODE :", checkCode)

    if (!checkCode) {
      return res.json({ result: false, error: "Code de l'application incorrect !" })
    }


    // Vérification que l'utilisateur n'est pas déjà enregistré
    const data = await User.findOne({ email })
    if (data) {
      res.json({
        result: false,
        error: 'Utilisateur déjà enregistré !'
      })
      return
    }
    else {

      const hash = bcrypt.hashSync(password, 10)
      const token = uid2(32)

      const jwtToken = jwt.sign({
        token,
      }, secretToken)

      const newUser = new User({
        firstname,
        name,
        email,
        password: hash,
        inscription_date: new Date(),
        token,
        coach,
      })
      const data = await newUser.save()

      res.json({ result: true, jwtToken, firstname, name, email, is_admin: data.is_admin, is_allowed: data.is_allowed })
    }
  }
  catch (err) {
    res.json({ err })
    console.log(err)
  }
});





// Route Signin pour se connecter

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body

    await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })

    const userData = await User.findOne({ email })

    if (!userData || !bcrypt.compareSync(password, userData.password)) {
      res.json({ result: false, error: "Email ou mot de passe incorrect !" })
      return
    }
    else {
      const token = uid2(32)
      const newJwtToken = jwt.sign({
        token,
      }, secretToken)


      userData.token = token

      await userData.save()

      res.json({ result: true, firstname: userData.firstname, name: userData.name, email: userData.email, jwtToken: newJwtToken, is_admin: userData.is_admin, is_allowed: userData.is_allowed, push_token: userData.push_token, bookmarks: userData.bookmarks })

    }
  } catch (err) {
    console.log(err)
    res.json({ result: false, err })
  }
})


// Route pour obtenir tous les users

router.get('/all-users', async (req, res) => {
  try {
    await mongoose.connect(connectionString, { connectTimeoutMS: 6000 })

    const usersData = await User.find()

    const users = usersData.map(e=>{
      e.password = ""
      e.push_token = ""
      e.token = ""
      return e
    })

    res.json({result : true, users})


  } catch (err) {
    console.log(err)
    res.json({ result: false, err })
  }
})




module.exports = router;
