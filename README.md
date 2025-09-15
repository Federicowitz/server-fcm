# PrimeGenesis Dashboard

Questo progetto è un **side project in fase di sviluppo** per un futuro MVP (Minimum Viable Product).

L’applicazione permette di registrarsi, effettuare login e inviare transazioni sulla **Solana Devnet**, con notifiche push per richiedere la firma delle transazioni. ⚡ L’app è attiva, ma continuo a sviluppare nuove funzionalità.

La **sicurezza è massima**: la chiave privata dell'utente **non lascia mai il telefono**.

---

## Caratteristiche principali

* **Registrazione e login** sicuri con hashing delle password e JWT.
* **Gestione sessione utente** tramite cookie sicuri.
* **Invio di transazioni SOL** sulla Devnet di Solana.
* **Notifiche push** tramite Firebase Cloud Messaging (FCM).
* **Dashboard web** responsive per visualizzare wallet, inviare transazioni e gestire l’account.
* **Preparata per integrazione mobile** tramite React Native.
* Sicurezza garantita: la chiave privata **rimane sempre sul dispositivo dell'utente**.

---

## Tecnologie utilizzate

### Backend

* **Node.js** & **Express** per il server REST API.
* **PostgreSQL** per la gestione dei dati utenti.
* **bcrypt** per hash sicuri delle password.
* **JWT** per autenticazione e gestione della sessione.
* **Firebase Admin SDK** per invio notifiche push.

### Blockchain

* **Solana Web3.js** per interagire con la Devnet e gestire transazioni SOL.

### Frontend Web

* **HTML5 / CSS3 / JavaScript vanilla** per la dashboard web.
* Layout responsive e gestione wallet integrata.

### Mobile (work-in-progress)

* **React Native** per lo sviluppo di app cross-platform.
* **Android Studio** per test e build su dispositivi Android.

### Deployment

* Configurato per il deploy su **Render** (attualmente usato come repository e server di test).

---

## Setup locale

1. Clonare il repository:

   ```bash
   git clone <repo-url>
   ```
2. Installare le dipendenze:

   ```bash
   npm install
   ```
3. Configurare le variabili d’ambiente:

   * `DATABASE_URL` → URL del database PostgreSQL
   * `JWT_SECRET` → Chiave segreta per JWT
   * `GOOGLE_APPLICATION_CREDENTIALS_JSON` → Credenziali Firebase in JSON
4. Avviare il server:

   ```bash
   npm start
   ```

   Il server sarà accessibile su `http://localhost:3000` (o porta configurata).

---

## Note

* L’applicazione è **attiva e funzionante**, ma alcune funzionalità sono in fase di sviluppo o testing.
* Il backend gestisce sia la dashboard web che la futura integrazione mobile.
* Alcune funzioni, in particolare transazioni e notifiche push, richiedono **chiavi e credenziali attive** per funzionare correttamente.

---

# English Version

# PrimeGenesis Dashboard

This project is a **side project in active development** for a future MVP (Minimum Viable Product).

The application allows users to register, login, and send transactions on the **Solana Devnet**, with push notifications to request transaction signing. ⚡ The app is live, but new features are continuously being developed.

**Maximum security:** the user's private key **never leaves their device**.

## Main Features

* Secure **registration and login** using password hashing and JWT.
* **User session management** via secure cookies.
* **Sending SOL transactions** on the Solana Devnet.
* **Push notifications** via Firebase Cloud Messaging (FCM).
* Responsive **web dashboard** to view wallet, send transactions, and manage account.
* **Mobile integration-ready** using React Native.
* High security: private key **always stays on the user's device**.

## Technologies Used

### Backend

* **Node.js** & **Express** for REST API server.
* **PostgreSQL** for user data storage.
* **bcrypt** for secure password hashing.
* **JWT** for authentication and session management.
* **Firebase Admin SDK** for push notifications.

### Blockchain

* **Solana Web3.js** for interacting with the Devnet and handling SOL transactions.

### Web Frontend

* **HTML5 / CSS3 / Vanilla JavaScript** for the dashboard.
* Responsive layout with integrated wallet management.

### Mobile (work-in-progress)

* **React Native** for cross-platform app development.
* **Android Studio** for testing and building on Android devices.

### Deployment

* Configured for deployment on **Render** (currently used as repository and test server).

## Local Setup

1. Clone the repository:

   ```bash
   git clone <repo-url>
   ```
2. Install dependencies:

   ```bash
   npm install
   ```
3. Configure environment variables:

   * `DATABASE_URL` → PostgreSQL database URL
   * `JWT_SECRET` → JWT secret key
   * `GOOGLE_APPLICATION_CREDENTIALS_JSON` → Firebase credentials JSON
4. Start the server:

   ```bash
   npm start
   ```

   The server will be available at `http://localhost:3000` (or configured port).

## Notes

* The application is **active and functional**, but some features are still in development or testing.
* The backend manages both the web dashboard and future mobile integration.
* Some features, especially transactions and push notifications, require **active keys and credentials** to work properly.
