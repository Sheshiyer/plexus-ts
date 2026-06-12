/**
 * Test script to verify JWT decryption and Worker request
 * Run with: npx electron test-jwt.js
 */

const { app, safeStorage } = require('electron');
const sqlite3 = require('sqlite3').verbose();

app.whenReady().then(async () => {
  const db = new sqlite3.Database('/Users/sheshnarayaniyer/.plexus/plexus.db');
  
  const getSetting = (key) => new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });

  try {
    const baseUrl = (await getSetting('tf.baseUrl')) || 'https://plexus-api.thoughtseed.space';
    const enc = await getSetting('tf.accessJwtEnc');
    
    console.log('Base URL:', baseUrl);
    console.log('JWT encrypted:', enc ? `${enc.substring(0, 50)}...` : 'null');
    console.log('safeStorage available:', safeStorage.isEncryptionAvailable());
    
    if (!enc) {
      console.log('No JWT found');
      app.quit();
      return;
    }
    
    let jwt;
    try {
      jwt = safeStorage.decryptString(Buffer.from(enc, 'base64'));
      console.log('JWT decrypted length:', jwt.length);
      console.log('JWT starts with:', jwt.substring(0, 50));
      
      const parts = jwt.split('.');
      console.log('JWT parts:', parts.length);
      
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('JWT payload:', JSON.stringify(payload, null, 2));
        console.log('JWT exp:', payload.exp, 'now:', Math.floor(Date.now() / 1000));
      }
    } catch (e) {
      console.error('JWT decryption failed:', e.message);
      app.quit();
      return;
    }
    
    // Make request to Worker
    console.log('\nTesting /v1/whoami with JWT...');
    try {
      const res = await fetch(`${baseUrl}/v1/whoami`, {
        headers: {
          'Accept': 'application/json',
          'Cf-Access-Jwt-Assertion': jwt,
        },
      });
      console.log('Response status:', res.status);
      const body = await res.text();
      console.log('Response body:', body);
    } catch (e) {
      console.error('Request failed:', e.message);
    }
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    app.quit();
  }
});
