// server.js

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const solanaWeb3 = require('@solana/web3.js');
const admin = require('firebase-admin');

const app = express();
const PORT = 3000;
const DB_FILE = './users.json';

// --- INIZIALIZZAZIONE FIREBASE ADMIN SDK ---
// Assicurati che il file 'serviceAccountKey.json' sia nella stessa cartella
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('Firebase Admin SDK inizializzato correttamente.');
// -----------------------------------------

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Per leggere dati da form HTML
app.use(express.static('public')); // Serve i file nella cartella 'public'

// Connessione a Solana Devnet
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');
console.log('Connesso al Devnet di Solana.');

// Funzioni per leggere/scrivere utenti (invariate dal tuo codice)
const readUsers = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    const data = fs.readFileSync(DB_FILE);
    if (data.length === 0) return [];
    return JSON.parse(data);
};

const writeUsers = (users) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
};

// --- ENDPOINT DI REGISTRAZIONE E LOGIN (invariati) ---
app.post('/register', (req, res) => {
    const { email, password, publicKey } = req.body; // Aggiunto publicKey opzionale
    if (!email || !password) {
        return res.status(400).json({ message: 'Email e password sono obbligatori.' });
    }
    const users = readUsers();
    if (users.find(user => user.email === email)) {
        return res.status(409).json({ message: 'Utente già registrato.' });
    }
    const newUser = { id: Date.now(), email, password, publicKey: publicKey || null };
    users.push(newUser);
    writeUsers(users);
    console.log(`Nuovo utente registrato: ${email}`);
    res.status(201).json({ message: 'Registrazione avvenuta con successo!' });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email e password sono obbligatori.' });
    }
    const users = readUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({ message: 'Credenziali non valide.' });
    }
    console.log(`Utente loggato: ${email}`);
    res.status(200).json({ message: 'Login effettuato con successo!', user });
});


// --- NUOVO ENDPOINT PER PREPARARE E INVIARE LA TRANSAZIONE VIA FCM ---
app.post('/send-transaction-fcm', async (req, res) => {
    // Dati ricevuti dal form sulla pagina web
    const { userEmail, recipientAddress, amount, fcmToken } = req.body;

    console.log(`Richiesta di invio TX via FCM ricevuta da: ${userEmail}`);
    console.log(`Token FCM del dispositivo target: ${fcmToken}`);

    if (!userEmail || !recipientAddress || !amount || !fcmToken) {
        return res.status(400).json({ message: 'Email, indirizzo, importo e token FCM sono obbligatori.' });
    }

    try {
        // 1. Trova l'utente e la sua chiave pubblica nel DB
        const users = readUsers();
        const sender = users.find(u => u.email === userEmail);
        if (!sender || !sender.publicKey) {
            return res.status(404).json({ message: 'Utente non trovato o senza una chiave pubblica associata.' });
        }

        // 2. Prepara la transazione (logica identica a prima)
        const senderPubKey = new solanaWeb3.PublicKey(sender.publicKey);
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

        // 3. Serializza la transazione in Base64
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
        }).toString('base64');
        
        console.log('Transazione non firmata creata e serializzata.');

        // 4. Prepara il messaggio FCM
        // Usiamo un "data message" (messaggio di dati) perché è più affidabile
        // per inviare payload che l'app deve processare in background.
        const message = {
            // La parte 'notification' che verrà mostrata all'utente
            // quando l'app è in background o chiusa.
            notification: {
                title: 'Richiesta di Firma Transazione',
                body: `Hai una nuova transazione di ${amount} SOL da firmare.`
            },
            // La parte 'data' che contiene le informazioni che la nostra app
            // userà quando l'utente tocca la notifica.
            data: {
                unsignedTransaction: serializedTransaction,
                amount: amount.toString(),
                recipient: recipientAddress,
                sender: sender.publicKey
            },
            // Aggiungiamo opzioni di priorità per migliorare la consegna
            android: {
                priority: 'high', // Priorità alta su Android
            },
            apns: {
                payload: {
                    aps: {
                        contentAvailable: true, // Priorità alta su iOS
                    },
                },
            },
            token: fcmToken
        };
        // 5. Invia il messaggio tramite FCM
        console.log('Invio della transazione al dispositivo tramite FCM...');
        const fcmResponse = await admin.messaging().send(message);
        console.log('Messaggio inviato con successo:', fcmResponse);

        res.status(200).json({ 
            message: 'Transazione inviata con successo al dispositivo per la firma.',
            fcmMessageId: fcmResponse,
        });

    } catch (error) {
        console.error('Errore durante la creazione o l\'invio FCM:', error);
        // Controlla se l'errore è di Firebase per dare un messaggio più specifico
        if (error.code && error.code.startsWith('messaging/')) {
            return res.status(400).json({ message: 'Errore FCM: ' + error.message });
        }
        res.status(500).json({ message: 'Errore del server: ' + error.message });
    }
});


// Avvio del server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
    console.log(`Apri http://localhost:${PORT} nel tuo browser per accedere all'interfaccia di test.`);
});