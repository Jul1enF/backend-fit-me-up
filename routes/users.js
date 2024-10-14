var express = require('express');
var router = express.Router();
const User = require('../models/users')

const bcrypt = require('bcrypt')
const uid2 = require('uid2')
const jwt = require('jsonwebtoken')
const secretToken = process.env.SECRET_TOKEN

const { Expo } = require('expo-server-sdk')


// Route signup pour s'inscrire

router.post('/signup', async (req, res) => {
  try {
    const { firstname, name, email, password } = req.body

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
      })
      const data = await newUser.save()

      res.json({ result: true, jwtToken, firstname, is_admin : data.is_admin })
    }
  }
  catch (err) {
    res.json({ err })
    console.log(err)
  }
});



module.exports = router;
