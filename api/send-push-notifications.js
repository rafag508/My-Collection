// api/send-push-notifications.js
// ✅ Vercel Serverless Function - Envia push notifications para filmes/séries que saem hoje

import admin from 'firebase-admin';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
    admin.initializeApp({
      credential: admin.credential.cert(credentials)
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responder a preflight requests
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Verificar autenticação (cron job ou secret key)
  const authHeader = req.headers.authorization;
  const secretKey = process.env.CRON_SECRET_KEY;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  if (!isVercelCron && authHeader !== `Bearer ${secretKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`[Push Notifications] Checking for releases on ${todayStr}`);

    // Buscar todos os utilizadores
    const usersSnapshot = await db.collection('users').get();
    let notificationsSent = 0;
    let errors = [];

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      
      try {
        // Buscar FCM token do utilizador
        const fcmTokenDoc = await db.doc(`users/${uid}/meta/fcmToken`).get();
        if (!fcmTokenDoc.exists) {
          continue; // Utilizador sem FCM token
        }
        
        const fcmToken = fcmTokenDoc.data().token;
        if (!fcmToken) {
          continue; // Token vazio
        }

        // Buscar filmes seguidos pelo utilizador
        const moviesSnapshot = await db.collection(`users/${uid}/movies`).get();
        const movies = moviesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filtrar filmes que saem hoje
        const moviesReleasingToday = movies.filter(movie => {
          if (!movie.release_date) return false;
          const releaseDate = movie.release_date.split('T')[0];
          return releaseDate === todayStr;
        });

        // Enviar notificação para cada filme
        for (const movie of moviesReleasingToday) {
          try {
            const message = {
              notification: {
                title: '🎬 Movie Released Today!',
                body: `${movie.title} is now available!`
              },
              data: {
                type: 'movie_release',
                movieId: movie.id,
                url: `/allmovie.html?id=${movie.id}`
              },
              token: fcmToken
            };

            await admin.messaging().send(message);
            notificationsSent++;
            console.log(`[Push Notifications] Sent notification to ${uid} for movie: ${movie.title}`);
          } catch (sendError) {
            console.error(`[Push Notifications] Error sending notification for movie ${movie.id}:`, sendError);
            errors.push({ uid, movieId: movie.id, error: sendError.message });
          }
        }

        // TODO: Implementar para séries quando necessário
        // Buscar séries seguidas (se tiveres uma coleção similar)
        // const seriesSnapshot = await db.collection(`users/${uid}/series`).get();
        // ...

      } catch (err) {
        console.error(`[Push Notifications] Error processing user ${uid}:`, err);
        errors.push({ uid, error: err.message });
      }
    }

    const response = {
      success: true,
      date: todayStr,
      notificationsSent,
      usersProcessed: usersSnapshot.size
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    console.log(`[Push Notifications] Completed: ${notificationsSent} notifications sent`);
    res.status(200).json(response);

  } catch (error) {
    console.error('[Push Notifications] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

