// server.js
const express = require('express');
const bodyParser = require('body-parser');
const solanaWeb3 = require('@solana/web3.js');
const admin = require('firebase-admin');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Connessione PostgreSQL ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // necessario per Render
});

// --- Inizializzazione Firebase Admin SDK ---
const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
console.log('Firebase Admin SDK inizializzato.');

// --- Middleware ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- Connessione Solana Devnet ---
const connection = new solanaWeb3.Connection(
  solanaWeb3.clusterApiUrl('devnet'),
  'confirmed'
);
console.log('Connesso al Devnet di Solana.');

// --- ENDPOINT REGISTRAZIONE ---
app.post('/register', async (req, res) => {
  const { email, publicKey } = req.body;
  if (!email) return res.status(400).json({ message: 'Email obbligatoria.' });

  try {
    const existing = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ message: 'Utente già registrato.' });

    const result = await pool.query(
      'INSERT INTO users (email, public_key) VALUES ($1, $2) RETURNING *',
      [email, publicKey || null]
    );

    res.status(201).json({ message: 'Registrazione avvenuta con successo!', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Errore del server' });
  }
});

// --- ENDPOINT LOGIN ---
app.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email obbligatoria.' });

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: 'Utente non trovato.' });

    res.status(200).json({ message: 'Login effettuato con successo!', user: userRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Errore del server' });
  }
});

// --- ENDPOINT INVIO TRANSAZIONE FCM ---
app.post('/send-transaction-fcm', async (req, res) => {
  const { userEmail, recipientAddress, amount, fcmToken } = req.body;

  if (!userEmail || !recipientAddress || !amount || !fcmToken) {
    return res.status(400).json({ message: 'Email, indirizzo, importo e token FCM obbligatori.' });
  }

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email=$1', [userEmail]);
    if (userRes.rows.length === 0 || !userRes.rows[0].public_key) {
      return res.status(404).json({ message: 'Utente non trovato o senza chiave pubblica.' });
    }

    const senderPubKey = new solanaWeb3.PublicKey(userRes.rows[0].public_key);
    const recipientPubKey = new solanaWeb3.PublicKey(recipientAddress);
    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new solanaWeb3.Transaction({
      recentBlockhash: blockhash,
      feePayer: senderPubKey,
    }).add(solanaWeb3.SystemProgram.transfer({
      fromPubkey: senderPubKey,
      toPubkey: recipientPubKey,
      lamports: amount * solanaWeb3.LAMPORTS_PER_SOL,
    }));

    const serializedTransaction = transaction.serialize({ requireAllSignatures: false }).toString('base64');

    const message = {
      notification: { title: 'Richiesta di Firma Transazione', body: `Hai una nuova transazione di ${amount} SOL.` },
      data: {
        unsignedTransaction: serializedTransaction,
        amount: amount.toString(),
        recipient: recipientAddress,
        sender: userRes.rows[0].public_key
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { contentAvailable: true } } },
      token: fcmToken
    };

    const fcmResponse = await admin.messaging().send(message);
    res.status(200).json({ message: 'Transazione inviata al dispositivo.', fcmMessageId: fcmResponse });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Errore del server: ' + err.message });
  }
});

// --- Avvio server ---
app.listen(PORT, () => {
  console.log(`Server in ascolto su http://localhost:${PORT}`);
});
