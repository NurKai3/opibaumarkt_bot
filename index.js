const mineflayer = require('mineflayer');
const mysql = require('mysql2');
const axios = require('axios');
const config = require('./config.json'); // Lädt die Konfiguration

function createOPIBot() {
    const webhookUrl = config.webhookUrl;

    // Discord-Webhook-Logging
    function sendDiscordLog(message, title = "Casino Log", color = 0xFF5733, player = null) {
        const embedMessage = {
            embeds: [{
                title: title,
                description: message,
                color: color,
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: player ? `https://mc-heads.net/avatar/${player}.png` : null // Spieler-Kopf als Thumbnail
                }
            }]
        };

        axios.post(webhookUrl, embedMessage)
            .catch(err => console.error('[WEBHOOK] Fehler beim Senden der Log-Nachricht:', err));
    }

    // MySQL-Datenbankverbindung
    const db = mysql.createConnection({
        host: config.mysql.host,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database
    });

    db.connect(err => {
        if (err) {
            console.error('[MYSQL] Datenbankverbindung fehlgeschlagen:', err);
        } else {
            console.log('[MYSQL] Mit der MySQL-Datenbank verbunden.');
        }
    });

    // Kontostand aus der Datenbank abrufen
    function getBalance(callback) {
        db.query('SELECT balance FROM Bot WHERE bank = "Bot"', (err, results) => {
            if (err) {
                console.error('[MYSQL] Fehler beim Abrufen des Kontostands:', err);
                callback(null);
            } else {
                const balance = results[0]?.balance || 0;
                console.log(`[MYSQL] Aktueller Kontostand: ${balance}`);
                callback(balance);
            }
        });
    }

    function setBalance(balance, callback) {
        const query = 'UPDATE Bot SET balance = ? WHERE bank = "Bot"';
        db.query(query, [balance], (err, results) => {
            if (err) {
                console.error('[MYSQL] Fehler beim Setzen des Kontostands:', err);
               
            }
        });
    }

    // Kontostand in der Datenbank aktualisieren
    function updateBalance(amount, operation, callback) {
        let query;
        if (operation === 'add') {
            query = 'UPDATE Bot SET balance = balance + ? WHERE bank = "Bot"';
        } else if (operation === 'subtract') {
            query = 'UPDATE Bot SET balance = balance - ? WHERE bank = "Bot"';
        } else {
            console.error('[MYSQL] Ungültige Operation:', operation);
            return callback(false);
        }

        db.query(query, [amount], (err) => {
            if (err) {
                console.error('[MYSQL] Fehler beim Aktualisieren des Kontostands:', err);
                callback(false);
            } else {
                console.log(`[MYSQL] Kontostand erfolgreich ${operation === 'add' ? 'hinzugefügt' : 'abgezogen'}: ${amount}`);
                callback(true);
            }
        });
    }

    // Minecraft-Bot erstellen
    const bot = mineflayer.createBot({
        host: 'blockbande.de',
        username: 'OPIBot',
        auth: 'microsoft',
        port: 25565,
        version: '1.20.4'
    });

    // Regex für Befehle
    const payRegex = /^!pay (\S+) (\d+)$/;
    const tpaRegex = /!tpa/;
    const discordRegex = /!discord/;
    const kontoRegex = /!konto/;

    // Autorisierungsprüfung
    function isAuthorizedUser(username) {
        return config.authorizedUsers.some(user => user.username === username);
    }

    // Chat-Handler
    let pendingPayments = {}; // Objekt für ausstehende Zahlungen (zwischenzeitliche Speicherung)

    bot.on('chat', (username, message) => {
        console.log(`[BOT] Chat von ${username}: ${message}`); // Debugging der eingehenden Nachricht
        
        // Entfernen des "Du: " Präfixes (falls vorhanden) und anderer unerwünschter Teile
        const cleanMessage = message.replace(/^[^\w]*Du:\s*/, '').trim();
        console.log(`[BOT] Bereinigte Nachricht: ${cleanMessage}`); // Debugging der bereinigten Nachricht
    
        // Nur autorisierte Benutzer können Befehle ausführen
        if (isAuthorizedUser(username)) {
                
            const tpaMessage = config.messages.tpa_send.replace("${username}", username);


            if (tpaRegex.test(message)) {
                bot.chat(`/tpa ${username}`);
                if(message2.includes('Dieser Spieler ist nicht auf CityBuild online.')) {
                    bot.chat(`/msg ${username} ${config.messages.player_not_online}`);
                } else {
                    bot.chat(`/msg ${username} ${tpaMessage}`);
                }
                console.log(`[BOT] ${tpaMessage}`);
            }

            if (kontoRegex.test(message)) {
                bot.chat(`/msg ${username} [Bot] Konto: ${lastBalance}`);
            }

            // Pay-Befehl
            const payMatch = cleanMessage.match(/^!pay (\S+) (\d+)$/);
            if (payMatch) {
                const targetUsername = payMatch[1]; // Spielername
                const amount = parseInt(payMatch[2]); // Betrag
                console.log(`[BOT] !pay erkannt: Zielspieler - ${targetUsername}, Betrag - ${amount}`); // Debugging

                //Message replac
 

                const paymentPendingMessage = config.messages.payment_pending
                .replace("${amount}", amount)       // Betrag ersetzen
                .replace("${targetUsername}", targetUsername)  // Zielbenutzer ersetze
                .replace("${amount}", amount)       // Betrag ersetzen
                .replace("${targetUsername}", targetUsername);  // Zielbenutzer ersetze


                const paymentSuccessMessage  = config.messages.payment_success
                .replace("${amount}", amount)       // Betrag ersetzen
                .replace("${targetUsername}", targetUsername)  // Zielbenutzer ersetze


                //ENDE

                if (amount > 0) {
                    // Wenn der Betrag über 10.000 liegt, speichern wir die Zahlung zwischen und fordern die Bestätigung
                    if (amount >= 10000) {
                        // Zahlung speichern und auf Bestätigung warten
                        pendingPayments[username] = { targetUsername, amount }; 
                        bot.chat(`/pay ${targetUsername} ${amount}`);
                        if(message.includes('Dieser Spieler ist nicht auf CityBuild online.')) {
                            bot.chat(`/msg ${username} ${config.messages.player_not_online}`);
                        } else {
                            bot.chat(`/msg ${username} [Bot] ${paymentPendingMessage}`);
                            console.log(`[BOT] Zahlung für ${username} wird mit Bestätigung abgewartet: /pay ${targetUsername} ${amount} confirm`);
                        }
                        
                    } else {
                        // Normale Zahlung ohne Bestätigung
                        getBalance(balance => {

                            if (balance >= amount) {
                                updateBalance(amount, 'subtract', success => {
                                    if (success) {
                                        bot.chat(`/pay ${targetUsername} ${amount}`);
                                        if(message.includes('Dieser Spieler ist nicht auf CityBuild online.')) {
                                            bot.chat(`/msg ${username} ${config.messages.player_not_online}`);
                                        } else {
                                            bot.chat(`/msg ${username} ${paymentSuccessMessage}`);
                                            sendDiscordLog(`${username} hat an ${targetUsername} $${amount} ausgezahlt.`, 'Zahlungsausgang', 0xFF0000, targetUsername);
                                            console.log(`[BOT] ${username} hat ${amount} an ${targetUsername} gezahlt.`);
                                        }
                                    } else {
                                        bot.chat(`/msg ${username} ${config.messages.payment_failed_remove}`);
                                    }
                                });
                            } else {
                                const balance_not_enough = config.messages.balance_not_enough.replace("${balance}", balance);

                                bot.chat(`/msg ${username} ${balance_not_enough}`);
                            }
                        });
                    }
                } else {
                    bot.chat(`/msg ${username} ${payment_invaild_nummer}`);
                }
            }
    
            // Überprüfung auf Bestätigungsbefehl
            const confirmMatch = cleanMessage.match(/^\!pay (\S+) (\d+) confirm$/);
            if (confirmMatch) {
                const confirmTarget = confirmMatch[1]; // Spielername
                const confirmAmount = parseInt(confirmMatch[2]); // Betrag

                
                const paymentConfirmMessage = config.messages.payment_confirm_success
                .replace("${confirmAmount}", confirmAmount)    // Betrag ersetzen
                  .replace("${confirmTarget}", confirmTarget);   // Zielbenutzer ersetzen

                console.log(`[BOT] Bestätigungsbefehl erkannt: Zielspieler - ${confirmTarget}, Betrag - ${confirmAmount}`);
    
                // Sicherstellen, dass die Zahlung tatsächlich aussteht und der Betrag übereinstimmt
                if (pendingPayments[username] && pendingPayments[username].targetUsername === confirmTarget && pendingPayments[username].amount === confirmAmount) {
                    // Überprüfen, ob der Benutzer genug Guthaben hat, um die Zahlung durchzuführen
                    getBalance(balance => {
                        if (balance >= confirmAmount) {
                            updateBalance(confirmAmount, 'subtract', success => {
                                if (success) {
                                    // Zahlung ausführen
                                    bot.chat(`/pay ${confirmTarget} ${confirmAmount} confirm`);
                                    if(message.includes('Dieser Spieler ist nicht auf CityBuild online.')) {
                                        bot.chat(`/msg ${username} ${config.messages.player_not_online}`);
                                        delete pendingPayments[username];
                                    } else {
                                        bot.chat(`/msg ${username} ${paymentConfirmMessage}`);
                                        sendDiscordLog(`${username} hat die Zahlung an ${confirmTarget} über $${confirmAmount} bestätigt.`, 'Zahlungsausgang', 0x00FF00, confirmTarget);
                                        console.log(`[BOT] ${username} hat die Zahlung an ${confirmTarget} über $${confirmAmount} bestätigt.`);
                                        // Nach Bestätigung löschen wir den ausstehenden Zahlungseintrag
                                        delete pendingPayments[username];
                                    }
                                    
                                } else {
                                    bot.chat(`/msg ${username} ${config.messages.payment_failed_remove}`);
                                }
                            });
                        } else {
                            const balance_not_enough = config.messages.balance_not_enough.replace("${balance}", balance);

                            bot.chat(`/msg ${username} ${balance_not_enough}`);
                        }
                    });
                } else {
                    // Falsche Bestätigung, keine ausstehende Zahlung
                    bot.chat(`/msg ${username} ${config.messages.payment_confirmation_invalid}`);

                }
            }
            
        } 
        if (discordRegex.test(message)) {
            console.log(`[DEBUG] Discord command detected from ${username}`);
            bot.chat(`/msg ${username} ${config.messages.discord || '[Bot] Kein Discord-Link konfiguriert.'}`);
        } 

    });
    let lastBalance = 0; // Letzter bekannter Kontostand

    // Funktion zum Verarbeiten von /money log-Antworten
    function handleMoneyLogResponse(responseMessage) {
        const balanceRegex = /Dein Kontostand: \$(\d{1,3}(?:\.\d{3})*)/; // Extrahiert den Kontostand
        const match = responseMessage.match(balanceRegex);
        
        if (match) {
            const currentBalance = parseInt(match[1].replace(/\./g, ''), 10); // Entfernt Punkte und konvertiert zu Zahl
            console.log(`[Casino-Bot] Aktueller Kontostand aus /money log: ${currentBalance}`);

            // Prüfen, ob der Kontostand aktualisiert werden muss
            if (currentBalance !== lastBalance) {
                console.log('[Casino-Bot] Kontostand hat sich geändert, Synchronisation wird gestartet.');
                setBalance(currentBalance); // Datenbank aktualisieren
                sendDiscordLog(`Neuer Kontostand: $${currentBalance}`, 'Kontostand synchronisiert', 0x00FF00, 'OPIBot');
                lastBalance = currentBalance; // Letzten bekannten Kontostand aktualisieren
            }
        } else {
            console.log('[Casino-Bot] Keine gültige Kontostands-Information in /money log gefunden.');
        }
    }

    // Event-Listener für eingehende Chat-Nachrichten
    bot.on('message', jsonMsg => {
        const message = jsonMsg.toString();
        if (message.includes('Dein Kontostand:')) {
            handleMoneyLogResponse(message); // Verarbeitet den Kontostand
        }
    });


    // Spawn-Handler
    bot.on('spawn', () => {
        bot.chat(`/home ${config.home.home}`);
        setInterval(() => {
            bot.chat(`/home ${config.home.home}`);
        }, 12 * 60 * 60 * 1200);
        setInterval(() => {
            bot.chat('/money');
            console.log('[BOT] Befehl /money log ausgeführt.');
        }, 15 * 1000);
    });

    // Verbindung trennen und erneut herstellen
    bot.on('end', (reason) => {
        console.log(`[BOT] Verbindung getrennt. Erneuter Versuch... Grund: ${reason}`);

        // Unterscheiden Sie zwischen verschiedenen Trennungsgründen
        if (reason === 'socketClosed') {
            console.log('[BOT] Verbindung wurde aufgrund von socketClosed geschlossen.');
        } else if (reason.includes('kicked')) {
            console.log('[BOT] Der Bot wurde vom Server gekickt.');
        } else {
            console.log('[BOT] Unerwartete Trennung. Grund: ' + reason);
        }
        bot.quit(); // Aktuelle Verbindung sauber beenden

        
        setTimeout(createOPIBot, 10000);
    });

    bot.on('error', (err) => {
        console.error('[BOT] Fehler aufgetreten:', err);
        sendDiscordLog(`[BOT] Fehler aufgetreten: ${err.message}`, 'Fehler', 0xFF0000);
    });
    
    // Kicks behandeln (falls vorhanden)
    bot.on('kick', (reason, loggedIn) => {
        console.log(`[BOT] Vom Server gekickt. Grund: ${JSON.stringify(reason)}. Eingeloggt: ${loggedIn}`);
    });

    bot.on('disconnect', (packet) => {
        console.log('[BOT] Verbindung getrennt. Paket:', packet);
    });

    // Beenden-Handler
    process.on('SIGINT', () => {
        console.log('[BOT] Bot wird beendet...');
        bot.quit();
        process.exit();
    });
}

createOPIBot();
