const twilio = require('twilio');

const ACCOUNT_SID = process.env.TWILIO_SID;
const AUTH_TOKEN  = process.env.TWILIO_TOKEN;
const FROM_NUMBER = process.env.TWILIO_FROM;
const TO_NUMBER   = process.env.MY_PHONE;

// OTP store (in-memory, per function instance, 5 min TTL)
const otpStore = {};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const body = JSON.parse(event.body || '{}');
  const action = body.action; // 'send' or 'verify'

  if (action === 'send') {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
    otpStore['current'] = { otp, expires };

    try {
      const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
      await client.messages.create({
        body: `Target $700 : ${otp} (5mins)`,
        from: FROM_NUMBER,
        to: TO_NUMBER
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (action === 'verify') {
    const { otp } = body;
    const stored = otpStore['current'];
    if (!stored) {
      return { statusCode: 400, headers, body: JSON.stringify({ valid: false, reason: 'no_otp' }) };
    }
    if (Date.now() > stored.expires) {
      delete otpStore['current'];
      return { statusCode: 400, headers, body: JSON.stringify({ valid: false, reason: 'expired' }) };
    }
    if (otp === stored.otp) {
      delete otpStore['current'];
      return { statusCode: 200, headers, body: JSON.stringify({ valid: true }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'wrong' }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown action' }) };
};
