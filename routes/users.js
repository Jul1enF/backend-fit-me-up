var express = require('express');
var router = express.Router();
const User = require('../models/users')

/* GET users listing. */
router.post('/', async(req, res) => {
  const {firstname} = req.body
  const newUser = new User({
    firstname,
  })

  await newUser.save()

  res.json({result : true})
});

module.exports = router;
