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

        // Buscar filmes seguidos pelo utilizador (following_movies, não movies)
        const moviesSnapshot = await db.collection(`users/${uid}/following_movies`).get();
        const movies = moviesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filtrar filmes que saem hoje e ainda não foram notificados
        const moviesReleasingToday = movies.filter(movie => {
          if (!movie.release_date) return false;
          // Se já foi notificado, não enviar novamente
          if (movie.releaseNotified) return false;
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
            
            // Marcar como notificado no Firestore
            try {
              const movieRef = db.doc(`users/${uid}/following_movies/${movie.id}`);
              await movieRef.update({ releaseNotified: true });
            } catch (markError) {
              console.warn(`[Push Notifications] Failed to mark movie ${movie.id} as notified:`, markError);
            }
          } catch (sendError) {
            console.error(`[Push Notifications] Error sending notification for movie ${movie.id}:`, sendError);
            errors.push({ uid, movieId: movie.id, error: sendError.message });
          }
        }

        // Buscar séries seguidas pelo utilizador (following_series)
        const seriesSnapshot = await db.collection(`users/${uid}/following_series`).get();
        const series = seriesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Para séries, precisamos verificar next_episode_to_air via TMDB API
        // Por agora, vamos apenas verificar se há séries com episódios que saem hoje
        // (A lógica completa requer chamada à API TMDB, que pode ser implementada depois)
        // Por enquanto, vamos apenas logar que há séries para processar
        if (series.length > 0) {
          console.log(`[Push Notifications] Found ${series.length} series to check for ${uid} (series push notifications require TMDB API call)`);
        }

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

