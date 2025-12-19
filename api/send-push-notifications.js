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
  // Testar conexão ao Firestore antes de processar
  try {
    console.log('[DEBUG] Testing Firestore connection...');
    console.log('[DEBUG] Firebase Admin initialized:', admin.apps.length > 0);
    
    // Verificar informações do projeto
    const app = admin.apps[0];
    if (app) {
      console.log('[DEBUG] Firebase App name:', app.name);
      console.log('[DEBUG] Firebase Project ID:', app.options.projectId);
    }
    
    // Verificar se consegue aceder ao Firestore
    console.log('[DEBUG] Firestore instance created');
    
    // Tentar listar coleções (pode não funcionar, mas vamos tentar)
    try {
      // Nota: listCollections() pode não estar disponível em todos os contextos
      // Mas vamos tentar outras formas de verificar
      console.log('[DEBUG] Attempting to query users collection...');
    } catch (e) {
      console.log('[DEBUG] Note: Cannot list collections directly');
    }
    
    // Tentar ler uma coleção de teste
    const testSnapshot = await db.collection('users').limit(1).get();
    console.log(`[DEBUG] Firestore test query: Found ${testSnapshot.size} users (limited to 1)`);
    
    // Listar todos os documentos
    const allUsersSnapshot = await db.collection('users').get();
    console.log(`[DEBUG] Total users in 'users' collection: ${allUsersSnapshot.size}`);
    
    if (allUsersSnapshot.size > 0) {
      console.log('[DEBUG] User IDs found:');
      allUsersSnapshot.docs.forEach(doc => {
        console.log(`[DEBUG]   - ${doc.id}`);
      });
    } else {
      console.log('[DEBUG] WARNING: No users found in collection!');
      console.log('[DEBUG] This could mean:');
      console.log('[DEBUG]   1. Collection is empty');
      console.log('[DEBUG]   2. Wrong database/project');
      console.log('[DEBUG]   3. Permission issues');
      console.log('[DEBUG]   4. Firestore is in Datastore mode instead of Native mode');
      
      // Tentar verificar se há outras coleções
      console.log('[DEBUG] Attempting to check if Firestore is accessible...');
      
      // Tentar criar um documento de teste (e depois apagar)
      try {
        const testRef = db.collection('_test_connection').doc('test');
        await testRef.set({ test: true, timestamp: Date.now() });
        console.log('[DEBUG] Successfully wrote test document - Firestore is accessible');
        await testRef.delete();
        console.log('[DEBUG] Successfully deleted test document');
      } catch (writeError) {
        console.error('[DEBUG] Failed to write test document:', writeError.message);
        console.error('[DEBUG] This suggests permission or access issues');
      }
    }
  } catch (testError) {
    console.error('[DEBUG] Firestore connection test FAILED:', testError);
    console.error('[DEBUG] Error code:', testError.code);
    console.error('[DEBUG] Error message:', testError.message);
    if (testError.stack) {
      console.error('[DEBUG] Stack trace:', testError.stack);
    }
  }
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
    console.log(`[DEBUG] Server time: ${today.toISOString()}, Today string: ${todayStr}`);

    // Buscar todos os utilizadores
    const usersSnapshot = await db.collection('users').get();
    console.log(`[DEBUG] Total users found: ${usersSnapshot.size}`);
    
    let notificationsSent = 0;
    let errors = [];
    let usersWithFCMToken = 0;
    let usersWithMovies = 0;
    let totalMoviesChecked = 0;

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      console.log(`[DEBUG] Processing user: ${uid}`);
      
      try {
        // Buscar FCM token do utilizador
        const fcmTokenDoc = await db.doc(`users/${uid}/meta/fcmToken`).get();
        if (!fcmTokenDoc.exists) {
          console.log(`[DEBUG] User ${uid}: No FCM token document found, skipping`);
          continue; // Utilizador sem FCM token
        }
        
        const fcmToken = fcmTokenDoc.data().token;
        if (!fcmToken) {
          console.log(`[DEBUG] User ${uid}: FCM token document exists but token is empty, skipping`);
          continue; // Token vazio
        }

        usersWithFCMToken++;
        console.log(`[DEBUG] User ${uid}: FCM token found (${fcmToken.substring(0, 20)}...)`);

        // Buscar filmes seguidos pelo utilizador (following_movies, não movies)
        const moviesSnapshot = await db.collection(`users/${uid}/following_movies`).get();
        const movies = moviesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        console.log(`[DEBUG] User ${uid}: Found ${movies.length} movies in following_movies`);
        
        if (movies.length === 0) {
          console.log(`[DEBUG] User ${uid}: No movies to check, skipping`);
          continue;
        }

        usersWithMovies++;
        totalMoviesChecked += movies.length;

        // Log detalhado de cada filme
        console.log(`[DEBUG] User ${uid}: Checking ${movies.length} movies:`);
        movies.forEach(movie => {
          console.log(`[DEBUG]   - Movie ${movie.id} (${movie.title}): release_date="${movie.release_date}", releaseNotified=${movie.releaseNotified || false}`);
        });

        // Filtrar filmes que saem hoje e ainda não foram notificados
        const moviesReleasingToday = movies.filter(movie => {
          if (!movie.release_date) {
            console.log(`[DEBUG]   Movie ${movie.id}: No release_date, skipping`);
            return false;
          }
          // Se já foi notificado, não enviar novamente
          if (movie.releaseNotified) {
            console.log(`[DEBUG]   Movie ${movie.id}: Already notified (releaseNotified=true), skipping`);
            return false;
          }
          const releaseDate = movie.release_date.split('T')[0];
          const matches = releaseDate === todayStr;
          console.log(`[DEBUG]   Movie ${movie.id}: releaseDate="${releaseDate}" === todayStr="${todayStr}" ? ${matches}`);
          return matches;
        });

        console.log(`[DEBUG] User ${uid}: Found ${moviesReleasingToday.length} movies releasing today`);

        // Enviar notificação para cada filme
        for (const movie of moviesReleasingToday) {
          try {
            console.log(`[DEBUG] User ${uid}: Preparing to send notification for movie ${movie.id} (${movie.title})`);
            
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
              console.log(`[DEBUG] User ${uid}: Marked movie ${movie.id} as notified in Firestore`);
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

    // Log resumo final
    console.log(`[DEBUG] Summary:`);
    console.log(`[DEBUG]   - Total users: ${usersSnapshot.size}`);
    console.log(`[DEBUG]   - Users with FCM token: ${usersWithFCMToken}`);
    console.log(`[DEBUG]   - Users with movies: ${usersWithMovies}`);
    console.log(`[DEBUG]   - Total movies checked: ${totalMoviesChecked}`);
    console.log(`[DEBUG]   - Notifications sent: ${notificationsSent}`);

    const response = {
      success: true,
      date: todayStr,
      notificationsSent,
      usersProcessed: usersSnapshot.size,
      debug: {
        usersWithFCMToken,
        usersWithMovies,
        totalMoviesChecked
      }
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

