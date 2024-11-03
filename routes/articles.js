var express = require('express');
var router = express.Router();

const Article = require('../models/articles')
const User = require('../models/users')

const jwt = require('jsonwebtoken')
const secretToken = process.env.SECRET_TOKEN
const jwtKey = process.env.JWT_KEY

const uniqid = require('uniqid');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const { Expo } = require('expo-server-sdk')



// Route pour poster ou modifier un article

router.post('/save-article/:articleData', async (req, res) => {
    try {

        const decryptedData = jwt.verify(req.params.articleData, jwtKey)

        const { title, sub_title, text, author, video_id, category, date, _id, jwtToken, localPic, img_link, img_public_id, img_margin_top, img_margin_left, img_zoom } = decryptedData

        const tmpUrl = process.env.TMP_URL

        const createdAt = new Date(date)


        const decryptedToken = jwt.verify(jwtToken, secretToken)
        let user = await User.findOne({ token: decryptedToken.token })

        // Vérification que l'utilisateur postant est bien admin
        if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé ou non autorisé. Essayez en vous reconnectant.' }) }



        // Si l'article existe déjà, modification de celui ci 
        if (_id !== "testArticleId") {
            let article = await Article.findOne({ _id })

            let definitivePictureUrl
            let definitivePictureId


            // Si nouvelle photo, enregistrement dans le cloud de celle ci et supression de l'ancienne
            if (localPic) {
                const photoPath = `${tmpUrl}/${uniqid()}.jpg`
                const resultMove = await req.files.articlePicture.mv(photoPath);

                if (!resultMove) {
                    const resultCloudinary = await cloudinary.uploader.upload(photoPath,
                        { folder: "fit-me-up", resource_type: 'image' })

                    fs.unlinkSync(photoPath)

                    if (resultCloudinary.secure_url) {
                        definitivePictureUrl = resultCloudinary.secure_url
                        definitivePictureId = resultCloudinary.public_id

                        // Supression de l'ancienne image
                        await cloudinary.uploader.destroy(img_public_id)
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

            article.img_public_id = definitivePictureId ? definitivePictureId : img_public_id

            article.img_margin_top = img_margin_top
            article.img_margin_left = img_margin_left
            article.img_zoom = img_zoom

            const articleModified = await article.save()
            console.log(articleModified)

            res.json({ result: true })

        }
        else {
            // Si l'article n'existe pas en BDD, enregistrement de celui ci, en commençant par uploader son image dans le cloud

            const photoPath = `${tmpUrl}/${uniqid()}.jpg`
            const resultMove = await req.files.articlePicture.mv(photoPath);

            if (resultMove) {
                res.json({ result: false, error: "Problème lors de l'upload de l'image" })
            }
            else {
                const resultCloudinary = await cloudinary.uploader.upload(photoPath,
                    { folder: "fit-me-up", resource_type: 'image' })

                fs.unlinkSync(photoPath)

                if (!resultCloudinary.secure_url) {
                    res.json({ result: false, error: "Problème d'enregistrement de l'image dans le cloud" })
                }

                // L'enregistrement dans le cloud a fonctionné, enregistrement de l'article en BDD
                else {
                    const newImgLink = resultCloudinary.secure_url
                    const newImgPublicId = resultCloudinary.public_id

                    const newArticle = new Article({
                        title,
                        sub_title,
                        img_link: newImgLink,
                        img_public_id : newImgPublicId,
                        img_margin_top,
                        img_margin_left,
                        img_zoom,
                        video_id,
                        category,
                        text,
                        createdAt,
                        author,
                    })

                    const articleSaved = await newArticle.save()


                    // Envoi d'une notification pour prévenir les utilisateurs du post

                    let frenchCategory
                    if(category === "recipes"){frenchCategory = "recette"}
                    else if (category === "exercices"){ frenchCategory="exercice"}
                    else {frenchCategory = "évènement"}

                    const postMessage = frenchCategory === "recette" ? `Une nouvelle ${frenchCategory} a été postée !` : `Un nouvel ${frenchCategory} a été posté !`


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
                                title: "Nouveau post !",
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
                            await User.updateOne({ push_token: pushToken }, { push_token: "" })
                        }
                    }

                    res.json({ result: true, url: resultCloudinary.secure_url })
                }
            }

        }

    } catch (err) {
        console.log(err)
        res.json({ result: false, err })
    }
})


// Route pour obtenir tous les articles

router.get('/getArticles/:jwtToken', async (req, res) => {
    try {

        const { jwtToken } = req.params

        const decryptedToken = jwt.verify(jwtToken, secretToken)
        let user = await User.findOne({ token: decryptedToken.token })

        // Vérification que l'utilisateur n'est pas bloqué
        if (!user || !user.is_allowed) { return res.json({ result: false, error: 'Utilisateur bloqué.' }) }


        const articles = await Article.find()

        if (articles){
            res.json({ result: true, articles})
            
        }
        else {
            res.json({ result: false, error: "Pas d'articles" })
        }

    } catch (err) {
        console.log("err :", err)
        res.json({ err })
    }
})


// Router pour supprimer un article de la bdd et son image du cloud

router.delete('/delete-article/:jwtToken/:_id', async (req, res)=>{
    try {
        const { jwtToken, _id } = req.params

        const decryptedToken = jwt.verify(jwtToken, secretToken)
        let user = await User.findOne({ token: decryptedToken.token })

        // Vérification que l'utilisateur postant est bien admin
        if (!user || !user.is_admin) { return res.json({ result: false, error: 'Utilisateur non trouvé, essayez en vous reconnectant.' }) }

        const article = await Article.findOne({_id})
        const img_public_id = article.img_public_id

        const deleteResult = await Article.deleteOne({_id})

        if (deleteResult.deletedCount !== 1){
            res.json({ result : false, error : "Problème de connexion à la base de donnée, merci de contacter le webmaster."})

            return
        }
        else {
            // Supression de l'article dans les favoris des utilisateurs
            await User.updateMany({bookmarks : _id}, {$pull : { bookmarks : _id }})

            // Supression de l'image du cloud
            await cloudinary.uploader.destroy(img_public_id)

            res.json({result : true})
        }

    }catch (err){
        console.log(err)
        res.json({result : false, err})
    }
})

module.exports = router;