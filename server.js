const express = require('express');
const bodyParser = require('body-parser');
const solanaWeb3 = require('@solana/web3.js');
const admin = require('firebase-admin');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET; // Da impostare su Render

const toCamelCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// --- Connessione PostgreSQL ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- Inizializzazione Firebase Admin SDK ---
// Legge le credenziali da una variabile d'ambiente
const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
console.log('Firebase Admin SDK inizializzato.');

// --- Middleware ---
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cookieParser());

// --- Connessione Solana Devnet ---
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');
console.log('Connesso al Devnet di Solana.');

// --- ENDPOINT REGISTRAZIONE ---
app.post('/register', async (req, res) => {
  const { firstName, lastName, username, email, password, publicKey, fcmToken } = req.body;
  if (!firstName || !lastName || !username || !email || !password || !publicKey) {
    return res.status(400).json({ message: 'Tutti i campi sono obbligatori.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const query = `
      INSERT INTO users (first_name, last_name, username, email, password_hash, public_key, fcm_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, username, first_name;
    `;
    const values = [firstName, lastName, username, email, passwordHash, publicKey, fcmToken || null];
    const result = await pool.query(query, values);
    res.status(201).json({ message: 'Registrazione avvenuta con successo!', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') { // Codice di errore per violazione 'unique'
      return res.status(409).json({ message: 'Email, Username o Wallet già registrato.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Errore interno del server' });
  }
});

// --- ENDPOINT LOGIN ---
app.post('/login', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(401).json({ message: 'Credenziali obbligatorie.' });

    try {
        const query = 'SELECT * FROM users WHERE email = $1 OR username = $1';
        const userRes = await pool.query(query, [identifier]);
        if (userRes.rows.length === 0) return res.status(401).json({ message: 'Credenziali non valide.' });

        const userWithSnakeCase = userRes.rows[0];
        const isPasswordValid = await bcrypt.compare(password, userWithSnakeCase.password_hash);
        if (!isPasswordValid) return res.status(401).json({ message: 'Credenziali non valide.' });
        
        // Convertiamo l'utente in camelCase per il resto della logica
        const user = toCamelCase(userWithSnakeCase);

        const expiresInSeconds = 300; // 1 ora
        const tokenPayload = { id: user.id, username: user.username };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: `${expiresInSeconds}s` });
        
        res.cookie('token', token, { httpOnly: true, maxAge: expiresInSeconds * 1000 });

        delete user.passwordHash; // Rimuove l'hash in camelCase
        res.status(200).json({ message: 'Login effettuato!', user: user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Errore del server' });
    }
});


// --- MIDDLEWARE AUTENTICAZIONE ---
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Accesso negato.' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Sessione non valida o scaduta.' });
        req.user = decoded;
        next();
    });
};

// --- ENDPOINT INVIO TRANSAZIONE (MODIFICATO per usare il middleware) ---
app.post('/send-transaction-fcm', authenticateToken, async (req, res) => {
  const { recipientIdentifier, amount } = req.body;
  const senderId = req.user.id;

  try {
    const senderRes = await pool.query('SELECT * FROM users WHERE id=$1', [senderId]);
    if (senderRes.rows.length === 0) return res.status(404).json({ message: 'Utente mittente non trovato.' });
    
    // Convertiamo subito il mittente in camelCase
    const sender = toCamelCase(senderRes.rows[0]);

    let recipientPubKey;
    try {
      recipientPubKey = new solanaWeb3.PublicKey(recipientIdentifier);
    } catch (e) {
      const recipientRes = await pool.query('SELECT public_key FROM users WHERE email=$1 OR username=$1', [recipientIdentifier]);
      if (recipientRes.rows.length === 0 || !recipientRes.rows[0].public_key) {
        return res.status(404).json({ message: 'Destinatario non trovato o senza wallet.' });
      }
      recipientPubKey = new solanaWeb3.PublicKey(recipientRes.rows[0].public_key);
    }
    
    // Ora usiamo le proprietà in camelCase, come 'sender.publicKey'
    const senderPubKey = new solanaWeb3.PublicKey(sender.publicKey);
    const { blockhash } = await connection.getLatestBlockhash();
    
    const transaction = new solanaWeb3.Transaction({
      recentBlockhash: blockhash,
      feePayer: senderPubKey,
    }).add(solanaWeb3.SystemProgram.transfer({
      fromPubkey: senderPubKey,
      toPubkey: recipientPubKey,
      lamports: parseFloat(amount) * solanaWeb3.LAMPORTS_PER_SOL,
    }));

    const serializedTransaction = transaction.serialize({ requireAllSignatures: false }).toString('base64');
    
    const message = {
      notification: { title: 'Richiesta di Firma Transazione', body: `Richiesta di invio di ${amount} SOL.` },
      data: { unsignedTransaction: serializedTransaction },
      token: sender.fcmToken // Usa la proprietà camelCase
    };
    
    await admin.messaging().send(message);
    res.status(200).json({ message: 'Richiesta inviata al dispositivo.' });

  } catch (err) {
    console.error("Errore Dettagliato:", err);
    res.status(500).json({ message: `Errore interno del server: ${err.message}` });
  }
});

// --- NUOVI ENDPOINT PER LA SESSIONE ---
// Endpoint per verificare se l'utente è già loggato (chiamato al caricamento della pagina)
app.get('/check-session', authenticateToken, async (req, res) => {
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
        if (userRes.rows.length === 0) return res.status(404).json({ message: 'Utente non trovato.'});
        
        const user = toCamelCase(userRes.rows[0]);
        delete user.passwordHash;
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Errore del server' });
    }
});

// Endpoint per il logout
app.post('/logout', (req, res) => {
    // Dice al browser di cancellare il cookie
    res.clearCookie('token');
    res.status(200).json({ message: 'Logout effettuato con successo.' });
});


// Avvio del server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server in ascolto sulla porta ${PORT} su tutti gli indirizzi di rete.`);
    console.log(`Pannello web accessibile su http://localhost:${PORT} o tramite l'IP di rete del PC.`);
});
