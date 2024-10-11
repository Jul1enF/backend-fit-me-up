var express = require('express');
var router = express.Router();

const Article = require('../models/articles')
const User = require('../models/users')

const jwt = require('jsonwebtoken')
const secretToken = process.env.SECRET_TOKEN

const uniqid = require('uniqid');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const { Expo } = require('expo-server-sdk')



// Route pour poster ou modifier un article

router.post('/save-article/:title/:sub_title/:text/:author/:video_id/:category/:date/:_id/:jwtToken/:localPic', async (req, res) => {
    try {

        const { title, sub_title, text, author, video_id, category, date, _id, jwtToken, localPic } = req.params

        const tmpUrl = process.env.TMP_URL

        const createdAt = new Date(date)

        const decryptedToken = jwt.verify(jwtToken, secretToken)
        let user = await User.findOne({ token: decryptedToken.token })

        // Vérification que l'utilisateur postant est bien admin
        if (!user) { return res.json({ result: false, error: 'Utilisateur non trouvé, essayez en reconnectant.' }) }



        // Si l'article existe déjà, modification de celui ci 
        if (_id !== "testArticleId") {
            let article = await Article.findOne({ _id })

            let definitivePictureUrl


            // Si nouvelle photo, enregistrement dans le cloud de celle ci
            if (localPic = "true") {
                const photoPath = `${tmpUrl}/${uniqid()}.jpg`
                const resultMove = await req.files.articlePicture.mv(photoPath);

                if (!resultMove) {
                    const resultCloudinary = await cloudinary.uploader.upload(photoPath,
                        { folder: "fit-me-up", resource_type: 'image' })

                    fs.unlinkSync(photoPath)

                    if (resultCloudinary.secure_url) {
                        definitivePictureUrl = resultCloudinary.secure_url
                    }

                    else { res.json({ result: false, error: "Problème d'enregistrement de l'image dans le cloud" }) }

                } else { res.json({ result: false, error: "Problème lors de l'upload de l'image" }) }
            }

            // Modification et enregistrement de l'article

            article.title = title
            article.sub_title = sub_title
            article.text = text
            article.video_id = video_id
            article.category = category
            article.author = author

            article.img_link = definitivePictureUrl ? definitivePictureUrl : img_link

            const articleModified = await article.save()
            console.log(articleModified)

            res.json({ result: true })

        }
        else {
            // Si l'article n'existe pas en BDD, enregistrement de celui ci, en commençant par uploader son image dans le cloud

            const photoPath = `${tmpUrl}/${uniqid()}.jpg`
            const resultMove = await req.files.articlePicture.mv(photoPath);

            if (!resultMove) {
                const resultCloudinary = await cloudinary.uploader.upload(photoPath,
                    { folder: "fit-me-up", resource_type: 'image' })

                fs.unlinkSync(photoPath)


                // L'enregistrement dans le cloud a fonctionné, enregistrement de l'article en BDD
                if (resultCloudinary.secure_url) {
                    const newImgLink = resultCloudinary.secure_url

                    const newArticle = new Article({
                        title,
                        sub_title,
                        img_link: newImgLink,
                        video_id,
                        category,
                        text,
                        createdAt,
                        author,
                    })

                    const articleSaved = await newArticle.save()

                    res.json({ result: true, url: resultCloudinary.secure_url })
                }

                else { res.json({ result: false, error: "Problème d'enregistrement de l'image dans le cloud" }) }

            } else { res.json({ result: false, error: "Problème lors de l'upload de l'image" }) }

        }

    } catch (err) {
        console.log(err)
        res.json({ result: false, err })
    }
})


// Route pour obtenir tous les articles

router.get('/getArticles', async (req, res) => {
    try {
        const articles = await Article.find()

        if (articles) {
            res.json({ result: true, articles })
        }
        else {
            res.json({ result: false, error: "Pas d'articles" })
        }

    } catch (err) {
        res.json({ err })
    }
})

module.exports = router;