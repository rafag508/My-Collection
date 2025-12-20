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

    console.log(`[Push Notifications] ========================================`);
    console.log(`[Push Notifications] Starting push notification check`);
    console.log(`[Push Notifications] Server time: ${today.toISOString()}`);
    console.log(`[Push Notifications] Today string: ${todayStr}`);
    console.log(`[Push Notifications] ========================================`);

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
        // Buscar FCM tokens do utilizador (novo formato: array de tokens)
        console.log(`[DEBUG] User ${uid}: Fetching FCM tokens...`);
        const fcmTokensDoc = await db.doc(`users/${uid}/meta/fcmTokens`).get();
        console.log(`[DEBUG] User ${uid}: fcmTokens document exists: ${fcmTokensDoc.exists}`);
        
        // Fallback para formato antigo (compatibilidade)
        let fcmTokens = [];
        if (fcmTokensDoc.exists) {
          const tokensData = fcmTokensDoc.data();
          console.log(`[DEBUG] User ${uid}: fcmTokens document data:`, JSON.stringify(tokensData, null, 2));
          if (Array.isArray(tokensData.tokens)) {
            fcmTokens = tokensData.tokens.map(t => t.token).filter(Boolean);
            console.log(`[DEBUG] User ${uid}: Extracted ${fcmTokens.length} token(s) from array format`);
          } else {
            console.log(`[DEBUG] User ${uid}: tokens field is not an array or missing`);
          }
        } else {
          console.log(`[DEBUG] User ${uid}: fcmTokens document does not exist, trying old format...`);
          // Tentar formato antigo (fcmToken singular)
          const fcmTokenDocOld = await db.doc(`users/${uid}/meta/fcmToken`).get();
          console.log(`[DEBUG] User ${uid}: Old fcmToken document exists: ${fcmTokenDocOld.exists}`);
          if (fcmTokenDocOld.exists) {
            const oldToken = fcmTokenDocOld.data().token;
            if (oldToken) {
              fcmTokens = [oldToken];
              console.log(`[DEBUG] User ${uid}: Using old format FCM token (migration needed)`);
            } else {
              console.log(`[DEBUG] User ${uid}: Old fcmToken document exists but token field is missing`);
            }
          }
        }
        
        if (fcmTokens.length === 0) {
          console.log(`[DEBUG] User ${uid}: ❌ No FCM tokens found, skipping user`);
          continue; // Utilizador sem FCM tokens
        }

        usersWithFCMToken++;
        console.log(`[DEBUG] User ${uid}: ✅ Found ${fcmTokens.length} FCM token(s)`);
        fcmTokens.forEach((token, idx) => {
          console.log(`[DEBUG] User ${uid}: Token ${idx + 1}: ${token.substring(0, 50)}...`);
        });

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

        // Se não há filmes a sair hoje, logar e continuar
        if (moviesReleasingToday.length === 0) {
          console.log(`[DEBUG] User ${uid}: No movies releasing today (all already notified or release_date not today)`);
          continue; // Passar para próximo utilizador
        }

        // Enviar notificação para cada filme (para todos os tokens)
        for (const movie of moviesReleasingToday) {
          console.log(`[DEBUG] ========================================`);
          console.log(`[DEBUG] User ${uid}: Processing movie ${movie.id} (${movie.title})`);
          console.log(`[DEBUG] User ${uid}: Will send to ${fcmTokens.length} device(s)`);
          console.log(`[DEBUG] User ${uid}: FCM Tokens:`, fcmTokens.map(t => t.substring(0, 30) + '...'));
          
          const invalidTokens = [];
          let successCount = 0;
          let errorCount = 0;
          
          // Enviar para todos os tokens do utilizador
          for (let i = 0; i < fcmTokens.length; i++) {
            const fcmToken = fcmTokens[i];
            console.log(`[DEBUG] User ${uid}: Attempting to send to token ${i + 1}/${fcmTokens.length} (${fcmToken.substring(0, 30)}...)`);
            
            try {
              const message = {
                notification: {
                  title: '🎬 Movie Released Today!',
                  body: `${movie.title} is now available!`,
                  icon: '/favicons/apple-touch-icon.png' // Ícone para notificações (quadrado azul com MC)
                  // Nota: 'image' não é suportado diretamente em notification para tokens de dispositivo
                  // Usar webpush.notification.image para browsers
                },
                data: {
                  type: 'movie_release',
                  movieId: movie.id,
                  url: `/allmovie.html?id=${movie.id}`,
                  image: movie.poster || '' // Guardar no data para uso na app (opcional)
                },
                // Suporte para web push (browsers) com imagem
                webpush: {
                  notification: {
                    title: '🎬 Movie Released Today!',
                    body: `${movie.title} is now available!`,
                    icon: '/favicons/apple-touch-icon.png',
                    badge: '/favicons/favicon-32x32.png',
                    image: movie.poster || null // Imagem grande do poster (apenas para browsers)
                  }
                },
                token: fcmToken
              };

              console.log(`[DEBUG] User ${uid}: Sending FCM message for movie ${movie.id}...`);
              const result = await admin.messaging().send(message);
              console.log(`[DEBUG] User ${uid}: FCM send result:`, result);
              
              notificationsSent++;
              successCount++;
              console.log(`[Push Notifications] ✅ Sent notification to ${uid} (device: ${fcmToken.substring(0, 20)}...) for movie: ${movie.title}`);
            } catch (sendError) {
              errorCount++;
              console.error(`[Push Notifications] ❌ Error sending to token ${fcmToken.substring(0, 20)}...:`, sendError);
              console.error(`[Push Notifications] Error code:`, sendError.code);
              console.error(`[Push Notifications] Error message:`, sendError.message);
              console.error(`[Push Notifications] Full error:`, JSON.stringify(sendError, Object.getOwnPropertyNames(sendError)));
              
              // Se token inválido, marcar para remoção
              if (sendError.code === 'messaging/invalid-registration-token' || 
                  sendError.code === 'messaging/registration-token-not-registered' ||
                  sendError.code === 'messaging/invalid-argument') {
                invalidTokens.push(fcmToken);
                console.log(`[Push Notifications] ⚠️ Marking token as invalid for removal: ${fcmToken.substring(0, 20)}...`);
              } else {
                errors.push({ uid, movieId: movie.id, token: fcmToken.substring(0, 20) + '...', error: sendError.message });
                console.log(`[Push Notifications] ⚠️ Other error (not invalid token), keeping token:`, sendError.code);
              }
            }
          }
          
          console.log(`[DEBUG] User ${uid}: Movie ${movie.id} summary - Success: ${successCount}, Errors: ${errorCount}, Invalid tokens: ${invalidTokens.length}`);
          
          // Remover tokens inválidos do Firestore
          if (invalidTokens.length > 0) {
            try {
              const tokensRef = db.doc(`users/${uid}/meta/fcmTokens`);
              const tokensSnap = await tokensRef.get();
              if (tokensSnap.exists) {
                const tokensData = tokensSnap.data();
                if (Array.isArray(tokensData.tokens)) {
                  console.log(`[DEBUG] Before cleanup: ${tokensData.tokens.length} token(s)`);
                  console.log(`[DEBUG] Invalid tokens to remove: ${invalidTokens.length}`);
                  
                  const validTokens = tokensData.tokens.filter(t => {
                    const isInvalid = invalidTokens.includes(t.token);
                    if (isInvalid) {
                      console.log(`[DEBUG] Removing invalid token: ${t.token.substring(0, 20)}... (device: ${t.deviceId?.substring(0, 8)}...)`);
                    }
                    return !isInvalid;
                  });
                  
                  // Só atualizar se houver tokens válidos (não apagar todos)
                  if (validTokens.length > 0) {
                    await tokensRef.update({ tokens: validTokens });
                    console.log(`[Push Notifications] Removed ${invalidTokens.length} invalid token(s) for user ${uid}. Remaining: ${validTokens.length}`);
                  } else {
                    console.warn(`[Push Notifications] WARNING: All tokens would be removed for user ${uid}. Keeping original tokens to prevent data loss.`);
                    // Não remover todos os tokens - pode ser um erro temporário
                  }
                }
              }
            } catch (cleanupError) {
              console.warn(`[Push Notifications] Failed to remove invalid tokens:`, cleanupError);
            }
          }
          
          // Marcar como notificado no Firestore (apenas uma vez por filme)
          try {
            const movieRef = db.doc(`users/${uid}/following_movies/${movie.id}`);
            await movieRef.update({ releaseNotified: true });
            console.log(`[DEBUG] User ${uid}: Marked movie ${movie.id} as notified in Firestore`);
          } catch (markError) {
            console.warn(`[Push Notifications] Failed to mark movie ${movie.id} as notified:`, markError);
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
          console.log(`[Push Notifications] ========================================`);
          console.log(`[Push Notifications] SUMMARY`);
          console.log(`[Push Notifications] ========================================`);
          console.log(`[Push Notifications] Total users processed: ${usersSnapshot.size}`);
          console.log(`[Push Notifications] Users with FCM tokens: ${usersWithFCMToken}`);
          console.log(`[Push Notifications] Users with movies: ${usersWithMovies}`);
          console.log(`[Push Notifications] Total movies checked: ${totalMoviesChecked}`);
          console.log(`[Push Notifications] Notifications sent: ${notificationsSent}`);
          console.log(`[Push Notifications] Errors: ${errors.length}`);
          if (errors.length > 0) {
            console.log(`[Push Notifications] Error details:`, JSON.stringify(errors, null, 2));
          }
          console.log(`[Push Notifications] ========================================`);

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

